
/*jshint node:true */
require(["dojo/dom",
         "dojo/_base/lang",
         "dojo/json",
         "esri/config",
         "esri/map",
         "esri/dijit/Search",
         "esri/graphic",
         "esri/geometry/Geometry",
         "esri/geometry/Extent",
         "esri/SpatialReference",
         "esri/tasks/GeometryService",
         "esri/tasks/AreasAndLengthsParameters",
         "esri/toolbars/draw",
         "esri/symbols/SimpleFillSymbol",
         "esri/layers/FeatureLayer",
         "dojo/domReady!"],
        function(dom, lang, json, esriConfig, Map, Search, Graphic, Geometry, Extent, SpatialReference, GeometryService, AreasAndLengthsParameters, Draw, SimpleFillSymbol, FeatureLayer){

    // Add streets basemap
    var map = new Map("mapDiv", {
        basemap: "hybrid", //Basemap type can be changed here.
        center: [-80.39 , 43.40],
        zoom: 14
    });

    /* This function is used to allow the user to draw their own polygon.
         The polygon is created using straight lines (not a freehand polygon)
         Instructions prompt the user how to draw polygon on the application */

    map.on("load", function() {
        var tb = new Draw(map);
        tb.on("draw-end", lang.hitch(map, getAreaAndLength));
        tb.activate(Draw.POLYGON);
    });
    var featureLayer = new FeatureLayer("https://ws.gisdynamic.lrc.gov.on.ca/public/rest/services/LIO_PUBLIC_DATA_SERVICES/geological_and_geophysical/MapServer/4");

    map.addLayer(featureLayer);

    /* This function allows the user to search for an address. The application
         will redirect the user to the location that was put into the search bar*/
    var search = new Search({
        map: map
    }, "search");
    search.startup();

    /* This function calls on the geometry service - "GeometryService" which will
         calculate the area and length of the polygon once the drawing is complete*/

    var geometryService = new GeometryService("https://sampleserver6.arcgisonline.com/arcgis/rest/services/Utilities/Geometry/GeometryServer");
    geometryService.on("areas-and-lengths-complete", outputAreaAndLength);

    function getAreaAndLength(evtObj) {
        var map = this,
            geometry = evtObj.geometry;
        map.graphics.clear();

        // This variable is assigned to the polygon which is drawn by the user
        var graphic = map.graphics.add(new Graphic(geometry, new SimpleFillSymbol()));

        //setup the parameters for the areas and lengths operation
        var areasAndLengthParams = new AreasAndLengthsParameters();
        areasAndLengthParams.lengthUnit = GeometryService.UNIT_FOOT; // length is calculated in feet
        areasAndLengthParams.areaUnit = GeometryService.UNIT_SQUARE_FEET; // area is calculated in square feet
        areasAndLengthParams.calculationType = "geodesic";
        geometryService.simplify([geometry], function(simplifiedGeometries) {
            areasAndLengthParams.polygons = simplifiedGeometries;
            geometryService.areasAndLengths(areasAndLengthParams);
        });
    }

    /* This function outputs the area and length information which is calculated
       by the geometry service. Note: Width is NOT calculated by the geometry
       service and therefore must be calculated manually using the area formula
       width = area/length */


    function outputAreaAndLength(evtObj) {
        var result = evtObj.result;
        console.log(json.stringify(result));
        var polyArea = result.areas[0].toFixed(3); // Calculates area in square feet
        dom.byId("area").innerHTML = polyArea;
        var polyLength = result.lengths[0].toFixed(3) ; // calculates length in feet
        dom.byId("length").innerHTML = polyLength;
        var polyWidth = (result.areas[0].toFixed(3) )/ (result.lengths[0].toFixed(3)); // calculates width in feet
        dom.byId("pwidth").innerHTML = polyWidth.toFixed(3) ;

        // This is for the White Cedar plant only. Other options need to be given.
        // This can be done using a dropdown which lists all the plants that can be used
        // I have left this here so you can see how its calculated and how its output to the user
        // White Cedar Information
        var WhiteCedarRows = polyWidth / 9;
        dom.byId("wcedarRow").innerHTML = WhiteCedarRows.toFixed(0) +" rows";
        var WhiteCedarPlants = polyLength / 6;
        dom.byId("wcedarLength").innerHTML = WhiteCedarPlants.toFixed(0) +" per row";
        var WhiteCedarTotal = WhiteCedarRows * WhiteCedarPlants;
        dom.byId("wcedartotal").innerHTML = WhiteCedarTotal.toFixed(0) +" plants";
        var WhiteCedarCost = WhiteCedarTotal * 0.85;
        dom.byId("wcedarCost").innerHTML = "$" + WhiteCedarCost.toFixed(2);

    }
});
