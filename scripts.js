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
         "esri/tasks/query",
         "esri/toolbars/draw",
         "esri/symbols/SimpleFillSymbol",
         "esri/layers/FeatureLayer",
         "esri/geometry/geometryEngine",
         "esri/symbols/SimpleMarkerSymbol",
         "esri/renderers/SimpleRenderer",
         "esri/symbols/SimpleLineSymbol",
         "esri/Color",
         "esri/tasks/FeatureSet",
         "dojo/on",
         "dojo/_base/array",
         "dojo/domReady!"],
        function(dom, lang, json, esriConfig, Map, Search, Graphic, Geometry, Extent,
                  SpatialReference, GeometryService, AreasAndLengthsParameters, Query, Draw, SimpleFillSymbol, FeatureLayer, geometryEngine, SimpleMarkerSymbol, SimpleRenderer,
                  SimpleLineSymbol, Color, FeatureSet, on, arrayUtil) {

    // Add streets basemap
    var map = new Map("mapDiv", {
        basemap: "hybrid", //Basemap type can be changed here.
        center: [-80.39 , 43.40],
        zoom: 14
    });

    // The REST service URL is used quite a bit, so it is replaced here by the variable 'soilURL'
    var soilURL = "https://ws.gisdynamic.lrc.gov.on.ca/public/rest/services/LIO_PUBLIC_DATA_SERVICES/geological_and_geophysical/MapServer/4"

    /* This function is used to allow the user to draw their own polygon.
         The polygon is created using straight lines (not a freehand polygon)
         Instructions prompt the user how to draw polygon on the application */

    map.on("load", function() {
        var tb = new Draw(map);
        tb.on("draw-end", lang.hitch(map, getAreaAndLength));
        tb.activate(Draw.POLYGON);
    });

    // Add the feature layers containing relevant data {e.g. soils, climate zones}, and specifies the specific desired fields
    var featureLayer = new FeatureLayer(soilURL, {
        mode: FeatureLayer.MODE_ONDEMAND,
        outFields: ["SHAPE", "OBJECTID", "SOIL_NAME1", "SOIL_NAME2", "SOIL_NAME3", "DRAINAGE1", "DRAINAGE2", "DRAINAGE3"]
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

        // Intersects the user-drawn graphic with the soil feature layer and runs a data processing function after.
        //   Feel free to rename these variable as you see fit, these names are temporary and are for testing purposes.

        // 'graphic' is a variable assigned to the polygon which is drawn by the user.
        var graphic = map.graphics.add(new Graphic(geometry, new SimpleFillSymbol()));

        // 'soilQuery' is the variable that will be used to select the underlying soil layer.
        var soilQuery = new Query();

        // These are properties of the query that are established to operate the intersect.
        soilQuery.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;
        soilQuery.geometry = graphic.geometry;
        soilQuery.outFields = ["SHAPE", "OBJECTID", "SOIL_NAME1", "SOIL_NAME2", "SOIL_NAME3", "DRAINAGE1", "DRAINAGE2", "DRAINAGE3"];

        // 'fs' is the variable representing the selection operation and 'fsComplete' runs
        //   the function 'useData' when the selection completes.
        var fsComplete = featureLayer.on("selection-complete", useData)
        var fs = featureLayer.selectFeatures(soilQuery, FeatureLayer.SELECTION_NEW);

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
    
    // 'useData' is a function that utilizes the data from the feature selection containing the layers
    //   intersecting with the user-drawn graphic
    function useData (event) {
        // 'soilFeatures' is an array consisting of arrays that hold the object id, soil names, and drainages of each selected feature.
        var soilFeatures = [];
        // This thing is a for loop that cycles through the selected features.
        arrayUtil.forEach(event.features, function (feature) {
            // 'currentSoilFeature' is the array that holds the information for each individual feature.
            var currentSoilFeature = []
            // This code block adds relevant data to the soil feature.
            currentSoilFeature += feature.attributes.OBJECTID;
            currentSoilFeature += feature.attributes.SOIL_NAME1;
            currentSoilFeature += feature.attributes.DRAINAGE1;
            // Adds the soil feature the the overall list.
            soilFeatures += currentSoilFeature;
            // Console output for testing. Remove at will.
            console.log("Soil feature: " + feature.attributes.OBJECTID);
        });
    }
    
    // Retreives the information off of species info csv
    var treeInfo;
    d3.csv("species_info_testvalues.csv", function(d) {
        return {
            species: d.species,
            soil: d.soil,
            spacingwidthft: +d.spacingwidthft,
            spacinglengthft: +d.spacinglengthft,
            cost: +d.cost,
            windbreak: d.windbreak,
            visualbarrier: d.visualbarrier,
            pollinator: d.pollinator,
            erosioncontrol: d.erosioncontrol,
            soundbarrier: d.soundbarrier,
            shade: d.shade
        };
    }, function(data) {
        treeInfo = data;
    });

    function attachCheckboxHandlers() {
        // get reference to element containing objectives checkboxes
        var el = document.getElementById('objective');

        // get reference to input elements in objectives container element
        var objs = el.getElementsByTagName('input');

        // assign updateTotal function to onclick property of each checkbox
        for (var i=0, len=objs.length; i<len; i++) {
            if ( objs[i].type === 'checkbox' ) {
                objs[i].onclick = checkboxHandlers;
            }
        }
    }

    // chooses a tree that matches the objectives chosen by user. It chooses the
    // last tree it encounters in the list of tree species that matches the objectives
    // It also updates the slider everytime a checkbox is clicked.
    var selectedTree;
    function checkboxHandlers() {
        // checks if the checkbox has been checked
        var windbreakBox = document.getElementById("windbreak").checked;
        var visualbarrierBox = document.getElementById("visualbarrier").checked;
        var pollinatorBox = document.getElementById("pollinatorhabitat").checked;
        var erosioncontrolBox = document.getElementById("erosioncontrol").checked;
        var soundbarrierBox = document.getElementById("soundbarrier").checked;
        var shadeBox = document.getElementById("shade").checked;
        // if the checkbox is checked then it checks if a tree species can do the
        // checked objective.
        for (var i=0; i<treeInfo.length; i++) {
            if (windbreakBox === true) {
                if (treeInfo[i].windbreak === "FALSE") { continue; }
            }
            if (visualbarrierBox === true) {
                if (treeInfo[i].visualbarrier === "FALSE") { continue; }
            }
            if (pollinatorBox === true) {
                if (treeInfo[i].pollinator === "FALSE") { continue; }
            }
            if (erosioncontrolBox === true) {
                if (treeInfo[i].erosioncontrolr === "FALSE") { continue; }
            }
            if (soundbarrierBox === true) {
                if (treeInfo[i].soundbarrier === "FALSE") { continue; }
            }
            if (shadeBox === true) {
                if (treeInfo[i].shade === "FALSE") { continue; }
            }
            selectedTree = treeInfo[i];
            outputCalculatedValues();
        }
    }


    /* This function outputs the area and length information which is calculated
       by the geometry service. Note: Width is NOT calculated by the geometry
       service and therefore must be calculated manually using the area formula
       width = area/length */
    var polyArea;
    var polyLength;
    var polyWidth;
    function outputAreaAndLength(evtObj) {
        var result = evtObj.result;
        console.log(json.stringify(result));
        polyArea = result.areas[0].toFixed(3); // Calculates area in square feet
        dom.byId("area").innerHTML = polyArea + " square feet";
        polyLength = result.lengths[0].toFixed(3) ; // calculates length in feet
        dom.byId("length").innerHTML = polyLength + " feet";
        polyWidth = (result.areas[0].toFixed(3) )/ (result.lengths[0].toFixed(3)); // calculates width in feet
        dom.byId("pwidth").innerHTML = polyWidth.toFixed(3) + " feet";
        outputCalculatedValues();
    }
    // outputs the values calculated using the dimensions and plant information given from selectedTree
    function outputCalculatedValues() {
        var treeSpecies = selectedTree.species;
        dom.byId("treespecies").innerHTML = treeSpecies;
        var costPerPlant = selectedTree.cost;
        dom.byId("costperplant").innerHTML = "$" + costPerPlant +" per plant";
        var selectedTreeRows = polyWidth / selectedTree.spacingwidthft;
        dom.byId("sTreeRow").innerHTML = selectedTreeRows.toFixed(0) +" rows";
        var selectedTreePlants = polyLength / selectedTree.spacinglengthft;
        dom.byId("sTreeLength").innerHTML = selectedTreePlants.toFixed(0) +" per row";
        var selectedTreeTotal = selectedTreeRows * selectedTreePlants;
        dom.byId("sTreeTotal").innerHTML = selectedTreeTotal.toFixed(0) +" plants";
        var selectedTreeCost = selectedTreeTotal * selectedTree.cost;
        dom.byId("sTreeCost").innerHTML = "$" + selectedTreeCost.toFixed(2);
    }
    // assigns the event handler for all of the checkboxes so that checkboxHandlers
    // is activated on-click.
    attachCheckboxHandlers()
    
    // This function will remove event listeners with the application closes to prevent memory leaks
    var myUnload = map.on("unload", unloadHandler);

    function unloadHandler(evt){
        fsComplete.remove();
        myUnload.remove();
    }
});
