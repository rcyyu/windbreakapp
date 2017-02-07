// This html file contains the intersect functionality for the Windbreak Application
// Ajahnis Charley
// 02/07/2017
// OMAFRA


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
		 "esri/tasks/QueryTask",
		 "esri/tasks/query",
         "esri/toolbars/draw",
         "esri/symbols/SimpleFillSymbol",
         "esri/layers/FeatureLayer",
		 "esri/geometry/geometryEngine",
		 "esri/symbols/SimpleMarkerSymbol",
		 "esri/renderers/SimpleRenderer",
		 "esri/symbols/SimpleLineSymbol",
		 "esri/Color",
         "dojo/domReady!"],
        function(dom, lang, json, esriConfig, Map, Search, Graphic, Geometry, Extent,
			SpatialReference, GeometryService, AreasAndLengthsParameters, QueryTask, Query, Draw, SimpleFillSymbol, FeatureLayer, geometryEngine, SimpleMarkerSymbol, SimpleRenderer,
			SimpleLineSymbol, Color){

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
	
	// Add the feature layers containing relevant data {e.g. soils, climate zones}, and specifies the specific desired fields
    var featureLayer = new FeatureLayer("https://ws.gisdynamic.lrc.gov.on.ca/public/rest/services/LIO_PUBLIC_DATA_SERVICES/geological_and_geophysical/MapServer/4", {
		outFields :["SOIL_NAME1", "SOIL_NAME2", "SOIL_NAME3", "DRAINAGE1", "DRAINAGE2", "DRAINAGE3"]
	});
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
		
			// selection symbol used to visualize underlying soil intersect area
		var sfs = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
			new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
			new Color([255,0,0]), 2),new Color([255,255,0,0.25])
		);
		featureLayer.setSelectionSymbol(sfs); 
		
		// Intersects the user-drawn graphic with the soil feature layer
		// Feel free to rename these variable as you see fit, these names are temporary and are for testing purposes
		
			// 'piece_geom' is the geometry object of the user-drawn graphic
		var piece_geom = evtObj.geometry;
			// 'graphic' is a variable assigned to the polygon which is drawn by the user
        var graphic = map.graphics.add(new Graphic(geometry, new SimpleFillSymbol()));
		
			// 'soilQuery' is the variable that will be used to select the underlying soil layer
		var soilQuery = new Query();
			// These are properties of the query that are established to operate the intersect
		soilQuery.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;
		soilQuery.geometry = graphic.geometry;
			// 'featureSelection' is the variable representing the selection operation
		var featureSelection = featureLayer.selectFeatures(soilQuery, FeatureLayer.SELECTION_NEW);
		
		// Use this to make unselected soil features invisible
		/*
        var nullSymbol = new SimpleMarkerSymbol().setSize(0);
        featureLayer.setRenderer(new SimpleRenderer(nullSymbol));
		*/
		
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
