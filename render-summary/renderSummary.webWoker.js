 var htmlInString = "",
   webWorkerDictionary,
   initialValues;

 (function(sortByPropertyOrder, htmlCreatorClass, changeEnumValues) {
   var htmlCreator = htmlCreatorClass();

   onmessage = function(e) {
     htmlCreator.summaryStartHTML();

     initValues(e.data);

     createHTMLFromSchema(initialValues);

     htmlCreator.summaryEndHTML();
     sendHTML();
   }

   function sendHTML() {
     postMessage(htmlInString);
     close();
   }

   function initValues(data) {
     initialValues = data[0],
       webWorkerDictionary = data[1];
   }

   function createHTMLFromSchema(targetObject, prefix) {
     prefix = (typeof prefix !== 'undefined') ? (prefix + '.') : '';
     var property_Order = sortByPropertyOrder(targetObject, prefix);

     property_Order.forEach(function(key) {
       var value = targetObject[key];


       // check for hidden fields in schema
       // and if include something then show number of licenses
       if ((webWorkerDictionary[prefix + key] && !webWorkerDictionary[prefix + key].hidden)) {
         if (typeof value === "object") {
           htmlCreator.summaryObjectHeadingStartHTML(prefix + key);
           createHTMLFromSchema(value, prefix + key);
           htmlCreator.summaryObjectHeadingEndHTML();
         } else {
           value = changeEnumValues(prefix + key, value);
           htmlCreator.summaryHeadingStartHTML(prefix + key);
           htmlInString += value;
           htmlCreator.summaryHeadingEndHTML(prefix + key);
         }
       }
     });
   }


 })(function sortByPropertyOrder(object, key) {
   return Object.keys(object).sort(function(a, b) {
     var ordera = webWorkerDictionary[key + a].propertyOrder;
     var orderb = webWorkerDictionary[key + b].propertyOrder;
     if (typeof ordera !== "number") ordera = 1000;
     if (typeof orderb !== "number") orderb = 1000;

     return ordera - orderb;
   });
 }, function htmlCreatorClass() {
   return {
     summaryStartHTML: function() {
       htmlInString += "<div style='position: relative;'>";
       htmlInString += "<div class='well well-sm'>";
     },
     summaryEndHTML: function() {
       htmlInString += "</div>";
       htmlInString += "</div>";
     },
     summaryObjectHeadingStartHTML: function(key) {
       htmlInString += "<div class='row' style='padding-left:0'>";
       htmlInString += "<div class='col-md-12' data-hierarchy = '" + webWorkerDictionary[key].hierarcy + "'>";
       htmlInString += "<h3><span>";
       htmlInString += webWorkerDictionary[key].title || key;
       htmlInString += "<span></h3>";
       htmlInString += "<div class='well well-sm'>";
     },
     summaryObjectHeadingEndHTML: function() {
       htmlInString += "</div>";
       htmlInString += "</div>";
       htmlInString += "</div>";
     },
     summaryHeadingStartHTML: function(key) {
       htmlInString += "<div class='row' style='padding-left:0'>";
       htmlInString += "<div class='col-md-12' data-hierarchy = '" + webWorkerDictionary[key].hierarcy + "'>";
       htmlInString += "<div class='form-group item-schema' style='display: inline'>";
       htmlInString += "<label class='control-label plaintext-label'>"
       htmlInString += webWorkerDictionary[key].title || key;
       htmlInString += "</label>";
       if (webWorkerDictionary[key].format === "textarea") {
         htmlInString += '<textarea class="form-control" disabled="" style="width: 60%;height: 100px;float: right;">';
       } else {
         htmlInString += "<span style='width: 45%; float: right;'>";
       }
     },
     summaryHeadingEndHTML: function(key) {
       if (webWorkerDictionary[key].format === "textarea") {
         htmlInString += "</textarea>";
       } else {
         htmlInString += "<span>";
       }
       htmlInString += "</div>";
       htmlInString += "</div>";
       htmlInString += "</div>";
     }
   }
 }, function changeEnumValues(key, value) {
   if (webWorkerDictionary[key].enum_options && webWorkerDictionary[key].enum_display &&
     webWorkerDictionary[key].enum_options.length && webWorkerDictionary[key].enum_display.length) {
     var index = webWorkerDictionary[key].enum_options.indexOf(value);
     return webWorkerDictionary[key].enum_display[index] || value;
   } else {
     return value;
   }
 });
