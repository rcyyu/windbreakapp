var app = {};
app.map = null; app.toolbar = null; app.tool = null; app.symbols = null; app.printer = null;
require([
    "dojo/ready", 
    "dojo/on",
    "dojo/_base/connect",
    "dojo/dom",
    "dojo/keys",
    "dijit/registry",
    "dojo/dom-construct",
    "dojo/parser", 
    "dijit/layout/BorderContainer", 
    "dijit/layout/ContentPane", 
    "dijit/layout/TabContainer",
    "esri/sniff",
    "esri/map",
    "esri/dijit/Measurement",
    "esri/dijit/Legend",
    "esri/arcgis/utils",
    "esri/domUtils",
    "esri/dijit/Popup",
    "dojo/json",
    "esri/config",
    "dojo/_base/lang",
    "dojo/_base/array",
    "esri/dijit/Search",
    "esri/dijit/Scalebar",
    "esri/graphic",
    "esri/graphicsUtils",
    "esri/dijit/Print",
    "esri/layers/ArcGISTiledMapServiceLayer", 
    "esri/layers/ArcGISDynamicMapServiceLayer",
    "esri/layers/LayerDrawingOptions",
    "esri/renderers/ClassBreaksRenderer",
    "esri/geometry/normalizeUtils",
    "esri/tasks/BufferParameters",
    "esri/geometry/Geometry",
    "esri/geometry/Extent" ,
    "esri/SpatialReference" ,
    "esri/tasks/GeometryService" ,
    "esri/tasks/AreasAndLengthsParameters" ,
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
    "dijit/form/Button",
    "dijit/WidgetSet",
    "dijit/TitlePane",
    "dijit/form/CheckBox",
    "dojo/domReady!"
], function(
        ready, on, connect, dom, keys, registry, domConstruct, parser, BorderContainer, ContentPane, TabContainer, has, Map, Measurement,
         Legend, arcgisUtils, domUtils, Popup, json, esriConfig, lang, arrayUtil, Search, Scalebar, Graphic, graphicsUtils, Print,
         ArcGISTiledMapServiceLayer, ArcGISDynamicMapServiceLayer, LayerDrawingOptions, ClassBreaksRenderer, normalizeUtils, BufferParameters, Geometry, Extent,
         SpatialReference, GeometryService , AreasAndLengthsParameters , Query, Draw, SimpleFillSymbol,
         FeatureLayer, geometryEngine, SimpleMarkerSymbol, SimpleRenderer, SimpleLineSymbol, Color, FeatureSet
        ) {
    ready(function(){
        parser.parse();
        esriConfig.defaults.io.proxyUrl = "/proxy/";
        app.printUrl = "http://intra.ws.gisdynamic.lrc.gov.on.ca/arcgis/services"
        //Create a map based on an ArcGIS Online web map id 
        app.map = new Map("map", {
            basemap: "hybrid", //Basemap type can be changed here.
            center: [-84.11 , 47.37],
            zoom: 6
        });
        // shows a scalebar on the map with metric and imperial units.
        var scalebar = new Scalebar({
            map: app.map,
            // "dual" displays both miles and kilometers
            // "english" is the default, which displays miles
            // use "metric" for kilometers
            scalebarUnit: "dual",
            scalebarStyle: "ruler"
        }, dojo.byId("scalebar"));

        var maxExtent;

        app.printer = new Print({
            map: app.map,
            url: "http://intra.ws.gisdynamic.lrc.gov.on.ca/arcgis/services"
        }, dom.byId("printButton"));
        app.printer.startup();
        /*
        //set max extent to inital extent
        dojo.connect(app.map, "onLoad", function(){
            maxExtent = app.map.extent;
        });

        //check to see if map is within max extent when its extent changes.  If not, roll back to the max
        //extent that we set above
        dojo.connect(app.map, "onExtentChange", function(extent){
            if((app.map.extent.xmin < maxExtent.xmin) ||
               (app.map.extent.ymin < maxExtent.ymin)  ||
               (app.map.extent.xmax > maxExtent.xmax) ||
               (app.map.extent.ymax > maxExtent.ymax) 
              ) {
                app.map.setExtent(maxExtent);
                console.log("max extent reached, rolling back to previous extent");
            }
        });
*/
        //disables all user accessible actions on the screen
        function actionDisabler() {
            var nodes = document.getElementById("leftPane").getElementsByTagName('*');
            for (var i=0; i<nodes.length; i++)  {
                nodes[i].disabled = true;
            }
            registry.byId('drawPolygon').set('disabled', true);
            document.getElementById("measurementBox").style.display = "none";
            document.getElementById("search").style.display = "none";
        }

        //enables all user accessible actions on the screen
        function actionEnabler() {
            registry.byId('drawPolygon').set('disabled', false);
            var nodes = document.getElementById("leftPane").getElementsByTagName('*');
            for (var i=0; i<nodes.length; i++)  {
                nodes[i].disabled = false;
            }
            document.getElementById("measurementBox").style.display = "block";
            document.getElementById("search").style.display = "block";
        }

        /* This function allows the user to search for an address. The application
         will redirect the user to the location that was put into the search bar*/
        var search = new Search({
            map: app.map
        }, "search");
        search.startup();

        // measurement widget is called to the map
        var measurement = new Measurement({
            map: app.map
        }, dom.byId("measurementDiv"));
        measurement.startup();

        var drawPolygonBtn = dom.byId("drawPolygon");
        var drawPolygon = new Draw(app.map, { showTooltips: true });

        on(drawPolygonBtn, "click", function(evt) {
            actionDisabler();
            drawPolygon.activate(Draw.POLYGON);
        });

        /* This function is used to allow the user to draw their own polygon.
         The polygon is created using straight lines (not a freehand polygon)
         Instructions prompt the user how to draw polygon on the application.
         When the user is drawing the other features on screen except the map
         are disabled. They are enabled when the polygon is drawn. */
        on(drawPolygon, "draw-end", function(evt){  
            drawPolygon.deactivate();
            actionEnabler();
            var geom = evt.geometry;
            if(geom.rings[0].length <= 3){
                alert("Polygon must have at least three vertices.");
                return;
            }
            getAreaAndLength(geom);
        });

        var gsvc = new GeometryService("https://utility.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer");
        /* This function allows the user to draw a polyline which is used to
         create a buffer around the affected area of a windbreak. */
        var drawPolylineBtn = dom.byId("drawPolyline");
        var drawPolyline = new Draw(app.map, { showTooltips: true });

        on(drawPolylineBtn, "click", function(evt) {
            actionDisabler();
            drawPolyline.activate(Draw.POLYLINE);
        });

        on(drawPolyline, "draw-end", function(evt){  
            drawPolyline.deactivate();
            actionEnabler();
            var geom = evt.geometry;
            doBuffer(geom);
        });

        function doBuffer(geom) {
            var symbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 1);
            var geometry = geom, symbol;

            var graphic = new Graphic(geometry, symbol);
            app.map.graphics.add(graphic);

            //setup the buffer parameters
            var params = new BufferParameters();
            params.distances = 15;
            params.outSpatialReference = app.map.spatialReference;
            params.unit = GeometryService.UNIT_KILOMETER;
            console.log(params);
            //normalize the geometry 
            params.geometries = [geometry];
            gsvc.buffer(params, showBuffer);
        }

        function showBuffer(bufferedGeometries) {
            var symbol = new SimpleFillSymbol(
                SimpleFillSymbol.STYLE_SOLID,
                new SimpleLineSymbol(
                    SimpleLineSymbol.STYLE_SOLID,
                    new Color([255,0,0,0.65]), 2
                ),
                new Color([255,0,0,0.35])
            );

            array.forEach(bufferedGeometries, function(geometry) {
                var graphic = new Graphic(geometry, symbol);
                app.map.graphics.add(graphic);
            });

        }

        function outputSoilArea(evtObj) {
            var result = evtObj.result;
            dom.byId("area").innerHTML = result.areas[0].toFixed(3);
        }

        // The REST service URL is used quite a bit, so it is replaced here by the variable 'soilURL'
        var soilURL = "https://ws.gisdynamic.lrc.gov.on.ca/public/rest/services/LIO_PUBLIC_DATA_SERVICES/geological_and_geophysical/MapServer/4"

        // Add the feature layers containing relevant data {e.g. soils, climate zones}, and specifies the specific desired fields
        var featureLayerSoil = new FeatureLayer(soilURL, {
            visible: true,
            mode: FeatureLayer.MODE_ONDEMAND,
            outFields: ["SHAPE", "OBJECTID", "SOIL_NAME1", "SOIL_NAME2", "SOIL_NAME3", "DRAINAGE1", "DRAINAGE2", "DRAINAGE3"]
        });
        app.map.addLayer(featureLayerSoil);

        /* This function calls on the geometry service - "GeometryService" which will
         calculate the area and length of the polygon once the drawing is complete*/
        var geometryService = new GeometryService("https://sampleserver6.arcgisonline.com/arcgis/rest/services/Utilities/Geometry/GeometryServer");
        geometryService.on("areas-and-lengths-complete", outputAreaAndLength);

        function getAreaAndLength(geom) {
            geometry = geom;
            app.map.graphics.clear();

            // selection symbol used to visualize underlying soil intersect area
            var sfs = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                                           new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                                                                new Color([255,0,0]), 2),new Color([255,255,0,0.25])
                                          );
            featureLayerSoil.setSelectionSymbol(sfs); 

            // Intersects the user-drawn graphic with the soil feature layer and runs a data processing function after.
            //   Feel free to rename these variable as you see fit, these names are temporary and are for testing purposes.

            // 'graphic' is a variable assigned to the polygon which is drawn by the user.
            var graphic = app.map.graphics.add(new Graphic(geometry, new SimpleFillSymbol()));

            // 'soilQuery' is the variable that will be used to select the underlying soil layer.
            var soilQuery = new Query();

            // These are properties of the query that are established to operate the intersect.
            soilQuery.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;
            soilQuery.geometry = graphic.geometry;
            soilQuery.outFields = ["SHAPE", "OBJECTID", "SOIL_NAME1", "SOIL_NAME2", "SOIL_NAME3", "DRAINAGE1", "DRAINAGE2", "DRAINAGE3"];

            // 'fs' is the variable representing the selection operation and 'fsComplete' runs
            //   the function 'useData' when the selection completes.
            var fsComplete = featureLayerSoil.on("selection-complete", useData);
            var fs = featureLayerSoil.selectFeatures(soilQuery, FeatureLayer.SELECTION_NEW);
            var fsTry = featureLayerSoil.getSelectedFeatures();

            //setup the parameters for the areas and lengths operation
            var areasAndLengthParams = new AreasAndLengthsParameters();

            areasAndLengthParams.lengthUnit = GeometryService.UNIT_FOOT; // length is calculated in feet
            areasAndLengthParams.areaUnit = GeometryService.UNIT_ACRES; // area is calculated in acres
            areasAndLengthParams.calculationType = "geodesic";
            geometryService.simplify([geometry], function(simplifiedGeometries) {
                areasAndLengthParams.polygons = simplifiedGeometries;
                geometryService.areasAndLengths(areasAndLengthParams);
            });
        }

        // 'useData' is a function that utilizes the data from the feature selection containing the layers
        //   intersecting with the user-drawn graphic
        function useData (event) {
            if (event.features.length < 10) {
                // 'soilFeatures' is an array consisting of arrays that hold the object id, soil names, and drainages of each selected feature.
                var soilFeatures = [];
                // 'justDrains' stores the DRAINAGE1 variable of each feature in the user's selection
                var justDrains = [];
                // 'soilRankArea' stores a list of soil type ranked by their area which is stored with it.
                var soilRankArea = [];

                // This thing is a for loop that cycles through the selected features.
                arrayUtil.forEach(event.features, function (feature) {
                    // creates the geometry of selected polygons intersecting with the selected area.
                    var intersection = geometryEngine.intersect(feature.geometry, geometry)
                    app.map.graphics.add(new Graphic(intersection, new SimpleFillSymbol()))

                    // Stores all the relevant DRAINAGE1 values, whilst preventing duplicates
                    if (!(justDrains.includes(drainageValues(feature.attributes.DRAINAGE1)))) {
                        justDrains.push(drainageValues(feature.attributes.DRAINAGE1));
                    }
                    // Adds area to a value of 'soilRankArea' if a soilValue already exists in the array
                    var i;
                    for (i=0; i<soilRankArea.length; i++) {
                        if (soilRankArea[i][0] == soilValues(feature.attributes.SOIL_NAME1)) {
                            soilRankArea[i][1] += geometryEngine.planarArea(intersection, "acres");
                            break;
                        }
                    }
                    // If a soil type does not exist in 'soilRankArea' then the value is added to the array in addition to its area.
                    if (i >= soilRankArea.length) {
                        soilRankArea[i] = [soilValues(feature.attributes.SOIL_NAME1), geometryEngine.planarArea(intersection, "acres")];
                    }

                    // sorts 'soilRankArea' by each soil types area in descending order.
                    soilRankArea.sort(function(a, b) {
                        if (a[1] > b[1]) {
                            return -1;
                        } else {
                            return 1;
                        }
                    })
                });
                // 'soilRank' stores a list of soil type ranked by their area.
                var soilRank = [];
                // strips 'soilRankArea' of the area value and stores the soil value in 'soilRank'
                for (var i=0; i<soilRankArea.length; i++) {
                    soilRank[i] = "<li>" + soilRankArea[i][0] + "</li>";
                }
                // Writes the DRAINAGE1 values to the info box
                dom.byId("drainage").innerHTML = justDrains.join('<br>');
                dom.byId("soilList").innerHTML = soilRank.join('');
            }
        }

        // This function consumes a DRAINAGE1 values and returns their corresponding description
        function drainageValues(value){
            switch (value) {
                case "I":
                    return "Imperfectly Drained";
                    break;
                case "VR":
                    return "Very Rapidly Drained";
                    break;
                case "R":
                    return "Rapidly Drained";
                    break;
                case "W":
                    return "Well Drained";
                    break;
                case "MW":
                    return "Moderately Well Drained";
                    break;
                case "P":
                    return "Poorly Drained";
                    break;
                case "VP":
                    return "Very Poorly Drained";
                    break;
                case "VA":
                    return "Variable";
                    break;
                default:
                    return "Not Applicable";
            }
        }

        // formats the soilValues so the letters are not all capitalized
        function soilValues(value) {
            return value.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();})
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

        // attaches CheckboxHandlers to checkboxes so that when the user clicks on any of the objective
        // checkboxes the function checkboxHandlers() is activated.
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
        var optimalTrees;
        function checkboxHandlers() {
            // checks if the checkbox has been checked
            var windbreakBox = document.getElementById("windbreak").checked;
            var visualbarrierBox = document.getElementById("visualbarrier").checked;
            var pollinatorBox = document.getElementById("pollinatorhabitat").checked;
            var erosioncontrolBox = document.getElementById("erosioncontrol").checked;
            var soundbarrierBox = document.getElementById("soundbarrier").checked;
            var shadeBox = document.getElementById("shade").checked;
            optimalTrees = [];
            // if the checkbox is checked then it checks if a tree species can do the
            // checked objective. Need to make this better...
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
                optimalTrees.push(treeInfo[i]);
                dropdownHandler();
            }
        }

        // updates the dropdown menu and sets the selected tree as the first item in the list.
        var selectedTree;
        function dropdownHandler() {
            var dropdownmenu = document.getElementById("treeSelectionDrop");
            // removes any previous options from menu.
            while (dropdownmenu.hasChildNodes()) {
                dropdownmenu.removeChild(dropdownmenu.lastChild);
            }
            // updates the options with optimalTrees.
            for (var i = 0; i < optimalTrees.length; i++) {
                var tree = optimalTrees[i]; 
                var el = document.createElement('option');
                el.textContent = tree.species;
                dropdownmenu.appendChild(el);
            }
            // sets the selected tree as the first tree.
            selectedTree = optimalTrees[0];
            outputCalculatedValues();
        }

        // when the user selects as tree from the drop down menu, selectedTree is updated
        // to contain the info of that tree.
        function selectTree() {
            el = document.getElementById("treeSelectionDrop")
            selectedTree = optimalTrees[el.selectedIndex];
            outputCalculatedValues();
        }
        document.getElementById("treeSelectionDrop").onchange = selectTree;


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
            dom.byId("area").innerHTML = polyArea + " acres";
            polyLength = result.lengths[0].toFixed(3) ; // calculates length in feet
            dom.byId("length").innerHTML = polyLength + " feet";
            polyWidth = (result.areas[0].toFixed(3) * 43560) / (result.lengths[0].toFixed(3)); // converts acres to square feet then calculates width in feet
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
        attachCheckboxHandlers();

        // This function will remove event listeners with the application closes to prevent memory leaks
        var myUnload = app.map.on("unload", unloadHandler);

        function unloadHandler(evt){
            fsComplete.remove();
            myUnload.remove();
        }

        // Shows a loading icon before the map is prepared.
        var loading = dom.byId("loadingImg");    
        function showLoading() {
            esri.show(loading);
        }

        function hideLoading(error) {
            esri.hide(loading);
        }
        hideLoading();
    });
});