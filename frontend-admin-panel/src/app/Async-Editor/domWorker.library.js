(function() {
  var Editor = arguments[0];
  var UtilClass = arguments[3]();
  var ValidationsClass = arguments[2](UtilClass);
  var EventsClass = arguments[1](UtilClass, ValidationsClass);

  UtilClass.$GetWebWorkerFile(function(webWorkerBlob) {
    window.DomWorker = Editor(UtilClass, EventsClass, ValidationsClass, webWorkerBlob);
  })
})(function(UtilClass, EventsClass, ValidationsClass, webWorkerBlob) {

  /**
   * DomWorkerClass:- manipulates the editor
   */
  function DomWorker(element, options) {
    this.$InitializeEditor(element, options);
    this.$AddEvents();
    var initOptions = this.$GetInitOptions("SchemaForm");
    this.$InitEditor(initOptions);

    return {
      "$on": UtilClass.$on.bind(this)
    }
  }

  UtilClass.$Inheritance(DomWorker, EventsClass);

  DomWorker.prototype.$InitEditor = InitEditor;
  DomWorker.prototype.$InitializeEditor = InitializeEditor;
  DomWorker.prototype.$GetInitOptions = GetInitOptions;
  DomWorker.prototype.$CreateDOM = CreateDOM;
  DomWorker.prototype.$AppendChild = AppendChild;
  DomWorker.prototype.$AddToolTip = AddToolTip;
  DomWorker.prototype.$AddDatePicker = AddDatePicker;
  DomWorker.prototype.$CalculateDates = CalculateDates;
  DomWorker.prototype.$CalculateStartDate = CalculateStartDate;
  DomWorker.prototype.$CalculateEndDate = CalculateEndDate;
  DomWorker.prototype.$Digest = Digest;
  DomWorker.prototype.$UpdateDictionary = UpdateDictionary;
  DomWorker.prototype.$ProcessEventLoop = ProcessEventLoop;
  DomWorker.prototype.$ContractLengthChanged = ContractLengthChanged;

  return DomWorker;

  function ProcessEventLoop() {
    if (this.eventLoop.length) {
      this.eventLoop.forEach(function(callback) {
        if (typeof callback === "function")
          callback.call(this);
      }.bind(this));

      this.eventLoop = [];
    }
  }

  function InitEditor(initOptions) {
    this.WebWorkerEditor = new Worker(webWorkerBlob);
    this.WebWorkerEditor.postMessage(initOptions);
    this.WebWorkerEditor.onmessage = OnEditorCreated.bind(this);
  };

  function InitializeEditor(element, options) {
    this.element = element.length ? element[0] : element;
    this.options = options;
    this.errors = [];
    this.eventLoop = [];
    this.count = 0;
    this.enableUTCDate = false;
    EventsClass.call(this);
  };

  function GetInitOptions(taskName, schema, initialValues, itemsPath) {
    return [{
      task: taskName,
      options: {
        validateConfiguration: this.options.validateConfiguration,
        schema: schema || this.options.schema,
        initialValues: initialValues || this.options.initialValues,
        scrollable: this.options.scrollable,
        heading: this.options.heading,
        translations: UtilClass.$Translations.call(this),
        events: this.parsedEvents,
        itemsPath: itemsPath,
        locale: this.options.$locale.locate,
        count: this.count,
        numberFormaters: this.options.$locale.NUMBER_FORMATS,
        wrapLevel: this.options.wrapLevel || null,
        textNoResults: this.options.textNoResults
      }
    }]
  };

  function OnEditorCreated(e) {
    this.errors = this.errors.concat(e.data.Editor.Errors);
    this.$ProcessEventLoop();
    var doc = this.$CreateDOM(e.data.HTMLString),
      selector;

    switch (e.data.task) {
      case 'SchemaForm':
        this.contractLength = e.data.contractLength;
        this.editor = e.data.Editor;
        this.editor.dynamicErrors = this.errors;
        this.count = e.data.Editor.count;
        this.$AddToolTip(doc.body);
        this.$CalculateDates(e.data.dateCalculations);
        this.$AddDatePicker(doc.body);
        selector = "#editorjsonform";
        break;
      case 'ItemsForm':
        selector = "[items-container]";
        this.$UpdateDictionary(e.data.Editor.Dictionary);
        break;
    }

    this.editor.getValue = UtilClass.$getValue.bind(this);
    this.editor.setValue = $RecreateEditor.bind(this);
    this.$AppendChild(selector, doc.body.children);
    MultipleOf.call(this, e.data.multipleOfCalculation);
    this.WebWorkerEditor.terminate();

    if (this.load)
      this.load();
  };

  // calculating multipleOf in webworker is not possible because we are using a very heavy
  // library to do it. It is not a good practice to send that library to web worker
  function MultipleOf(multipleOfCalculation) {
    if (multipleOfCalculation && multipleOfCalculation.length) {
      this.busy = true;
      multipleOfCalculation.forEach(function(path) {
        var currentTarget = this.element.querySelector("[data-origname='" + path + "']");
        if (currentTarget)
          this.$Apply(currentTarget, true, function(currentDictionary) {
            this.handleNumericFields(currentDictionary, currentTarget, this.options.$locale.NUMBER_FORMATS);
          });
      }.bind(this));
      this.busy = false;
    }
  };

  function $RecreateEditor(configuration, path) {
    this.busy = true; // forcing editor not to fire change or error callback untill configurations are updated/validated

    $WalkObject(configuration, path, function(path, value) {
      var element = this.element.querySelector("[data-origname='" + path + "']");
      var newValue = isNaN(parseFloat(value)) ? value : parseFloat(value);

      if (element && element.value != newValue) {
        updateElementValue(element, value);

        if (element.onchange)
          element.onchange({ "currentTarget": element });
      }
    }.bind(this));

    this.busy = false;
    this.$Digest(); // firing editor function change/error

    function updateElementValue(element, value) {
      if (element.type === "checkbox")
        element.checked = value;
      else {
        element.value = value;
        element.classList.add("value-changed");

        (function(element) {
          setTimeout(function() {
            element.classList.remove("value-changed");
          }, 5000);
        })(element)
      }
    }
  }



  function $WalkObject(object, prefix, callback) {
    prefix = (typeof prefix !== 'undefined') ? (prefix + '.') : 'root';

    for (var key in object) {
      var value = object[key];

      if (callback && typeof callback === "function" && typeof value !== "object")
        callback(prefix + key, value);

      if (typeof value === "object")
        $WalkObject(value, prefix + key, callback);
    }
  }

  function UpdateDictionary(Dictionary) {
    for (var key in Dictionary) {
      this.editor.Dictionary[key] = Dictionary[key];
    }
  }

  function CalculateDates(datesObject) {
    if (!Object.keys(datesObject).length)
      return;

    var contractLength = this.contractLength.toLowerCase();
    this.$CalculateStartDate(datesObject.startDate);
    this.$CalculateEndDate(datesObject, contractLength);
  }

  function CalculateStartDate(path) {
    var currentDictionary = UtilClass.$GetCurrentDictionary.call(this, path),
      date;

    if (!currentDictionary)
      return;

    var datepickerFormat = (moment().toMomentFormatString(this.options.$locale.DATETIME_FORMATS.shortDate)).replace('YY', 'YYYY') || 'MM/DD/YYYY';
    date = moment().utc().format(datepickerFormat);
    currentDictionary.value = date;
  }

  function CalculateEndDate(datesObject, contractLength, element, calendarDate) {
    var endDateDictionary = UtilClass.$GetCurrentDictionary.call(this, datesObject.endDate),
      startDateDictionary = UtilClass.$GetCurrentDictionary.call(this, datesObject.startDate),
      endDate, month, year;

    if (!endDateDictionary || !startDateDictionary || !startDateDictionary.value)
      return;

    if (contractLength.toLowerCase() === "open") {
      if (startDateDictionary && startDateDictionary.options && startDateDictionary.options.hidden &&
        endDateDictionary && endDateDictionary.options && endDateDictionary.options.hidden)
        endDateDictionary.value = "";
      else
        endDateDictionary.value = contractLength.toLowerCase();

      if (element)
        element.value = endDateDictionary.value;

      return;
    }

    var datepickerFormat = (moment().toMomentFormatString(this.options.$locale.DATETIME_FORMATS.shortDate)).replace('YY', 'YYYY') || 'MM/DD/YYYY';

    var quantity, unit;

    if (contractLength === 'yearly') {
      unit = 'y';
      quantity = 1;
    } else if (contractLength.indexOf("year") !== -1) {
      unit = 'y';
      quantity = parseInt(contractLength);
    } else if (contractLength.indexOf("monthly") !== -1) {
      quantity = 1;
      unit = 'M';
    } else if (contractLength.indexOf("month") !== -1) {
      quantity = parseInt(contractLength);
      unit = 'M';
    } else if (contractLength.indexOf('annual') !== -1) {
      quantity = 12;
      unit = 'M';
    } else { ///Products with a Montlhy contract length
      quantity = 1;
      unit = 'M';
    }

    endDateDictionary.value = moment(startDateDictionary.value, datepickerFormat).add(quantity, unit).add(-1, 'days').format(datepickerFormat);

    var argument = [calendarDate, endDateDictionary, startDateDictionary, datepickerFormat, element, quantity, unit]
    setEndDateToElement.apply(this, argument);
  }

  function setEndDateToElement(calendarDate, endDateDictionary, startDateDictionary, datepickerFormat, element, quantity, unit) {
    if (element) {
      if (this.enableUTCDate && calendarDate) {
        var calendarStartDate = moment(calendarDate, datepickerFormat).date();
        var endDate = moment(endDateDictionary.value, datepickerFormat).date();

        if (calendarStartDate === endDate)
          element.value = moment(endDateDictionary.value, datepickerFormat).add(-1, 'days').format(datepickerFormat);
        else
          element.value = moment(startDateDictionary.value, datepickerFormat).add(quantity, unit).format(datepickerFormat);
      } else
        element.value = endDateDictionary.value;
    }
  }

  function AddDatePicker(doc) {
    var calendarButton = doc.querySelectorAll(".calendar-datepicker");
    if (!calendarButton.length)
      return

    var monthNames, monthNamesShort, dayNames, dayNamesShort, datepickerFormat,
      that = this,
      endDateElement;

    monthNames = JSON.parse(sessionStorage.getItem('monthNames'));
    monthNamesShort = JSON.parse(sessionStorage.getItem('monthNamesShort'));
    dayNames = JSON.parse(sessionStorage.getItem('dayNames'));
    dayNamesShort = JSON.parse(sessionStorage.getItem('dayNamesShort'));

    datepickerFormat = (moment().toMomentFormatString(this.options.$locale.DATETIME_FORMATS.shortDate)).toLowerCase();

    window.jQuery.datepicker.setDefaults(window.jQuery.datepicker.regional[this.options.language]);
    window.jQuery.datepicker.setDefaults({
      "dateFormat": datepickerFormat
    });

    endDateElement = calendarButton[1];

    for (var i = 0; i < calendarButton.length; i++) {
      btn = calendarButton[i];
      $(btn.nextElementSibling).datepicker({
        firstDay: 1,
        monthNames: monthNames,
        monthNamesShort: monthNamesShort,
        dayNames: dayNames,
        dayNamesShort: dayNamesShort,
        dayNamesMin: dayNamesShort,
        orientation: "top",
        changeMonth: showChangeYearAndMonth(),
        changeYear: showChangeYearAndMonth(),
        onSelect: function() {
          var startDateDictionary = UtilClass.$GetCurrentDictionary.call(that, this.dataset.origname);
          startDateDictionary.value = getUTCDate.call(that, this.value);

          if (endDateElement && endDateElement.nextElementSibling) {
            var datesObject = {
              startDate: this.dataset.origname,
              endDate: endDateElement.nextElementSibling.dataset.origname
            };
            that.$CalculateEndDate(datesObject, that.contractLength, endDateElement.nextElementSibling, this.value);
          } else if (that.editor.Dictionary["root.contract.endDate"] && that.contractLength.toLowerCase() === "open") {
            that.editor.Dictionary["root.contract.endDate"].value = that.contractLength.toLowerCase();
          }


          for (var i = 0; i < calendarButton.length; i++) {
            var currentTarget = calendarButton[i].nextElementSibling;
            that.$Apply(currentTarget, false);
          }

        }
      });
    }
  }

  function getUTCDate(selectedDate, dateFormat) {
    var dateFormat = (moment().toMomentFormatString(this.options.$locale.DATETIME_FORMATS.shortDate)).replace('YY', 'YYYY') || 'MM/DD/YYYY';
    var localDate = new Date().getDate(),
      calendarDate = moment(selectedDate, dateFormat).date(),
      utcDate;

    if (localDate === calendarDate) {
      utcDate = moment().utc().format(dateFormat);
      this.enableUTCDate = calendarDate === moment(utcDate, dateFormat).date() ? false : true;
    } else
      this.enableUTCDate = false;

    return utcDate || selectedDate;
  }

  function ContractLengthChanged(currentDictionary) {
    this.contractLength = currentDictionary.value.toLowerCase();
    var datesObject = {
      startDate: "root.contract.startDate",
      endDate: "root.contract.endDate"
    };

    var endDateElement = this.element.querySelector("[data-origname='" + datesObject.endDate + "']");
    var startDateElement = this.element.querySelector("[data-origname='" + datesObject.startDate + "']");
    this.$CalculateEndDate(datesObject, this.contractLength, endDateElement, startDateElement.value);

    for (var path in datesObject) {
      var currentTarget = this.element.querySelector("[data-origname='" + datesObject[path] + "']");
      if (currentTarget.value)
        this.$Apply(currentTarget, false);
    }
  }

  function showChangeYearAndMonth(changeYearAndMonth) {
    return changeYearAndMonth !== undefined ? changeYearAndMonth : true;
  };

  function CreateDOM(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    return doc;
  }

  function AppendChild(selector, newElements) {
    var target = this.element.querySelector(selector);
    Array.prototype.slice.call(newElements).forEach(function(element) {
      target.appendChild(element);
    })
  }

  function AddToolTip(doc) {
    $(doc).find('[data-toggle="tooltip"]').tooltip();
  }

  function Digest() {
    if (this.errors.length)
      this.error()
    else
      this.change();
  }



}, function(UtilClass, ValidationsClass) {
  /**
   * EventsClass:- listen to editor events
   */

  function EventsClass() {};

  EventsClass.prototype.$AddEvents = AddEvents;
  EventsClass.prototype.handleInput = handleInput;
  EventsClass.prototype.handleDatePicker = handleDatePicker;
  EventsClass.prototype.handleSelect = handleSelect;
  EventsClass.prototype.collapse = collapse;
  EventsClass.prototype.addItems = addItems;
  EventsClass.prototype.deleteAllItems = deleteAllItems;
  EventsClass.prototype.deleteItems = deleteItems;
  EventsClass.prototype.deleteFromDictionary = deleteFromDictionary;
  EventsClass.prototype.removeFromArrayErrors = removeFromArrayErrors;
  EventsClass.prototype.reorderItems = reorderItems;
  EventsClass.prototype.$Apply = Apply;
  EventsClass.prototype.clearFilter = clearFilter;
  EventsClass.prototype.handleSearch = handleSearch;
  EventsClass.prototype.showSearchItems = showSearchItems;
  EventsClass.prototype.handleTextArea = handleTextArea;
  EventsClass.prototype.handleCheckbox = handleCheckbox;
  EventsClass.prototype.moveDown = moveDown;
  EventsClass.prototype.moveUp = moveUp;
  EventsClass.prototype.togglePosition = togglePosition;
  EventsClass.prototype.handleNumericFields = handleNumericFields;


  var $Events = {
    "add": "addItems{{schemaId}}(event)",
    "input": "handleInput{{schemaId}}(event)",
    "click": "handleClick{{schemaId}}(event)",
    "collapse": "collapse{{schemaId}}(event)",
    "delete": "deleteItems{{schemaId}}(event)",
    "change": "handleCheckbox{{schemaId}}(event)",
    "select": "handleSelect{{schemaId}}(event)",
    "deleteAll": "deleteAllItems{{schemaId}}(event)",
    "textarea": "handleTextArea{{schemaId}}(event)",
    "datepicker": "handleDatePicker{{schemaId}}(event)",
    "search": "handleSearch{{schemaId}}(event)",
    "clear": "clearFilter{{schemaId}}(event)",
    "moveDown": "moveDown{{schemaId}}(event)",
    "moveUp": "moveUp{{schemaId}}(event)"
  };


  return EventsClass;

  function handleSearch(event) {
    var searchValue = this.element.querySelector("#searcheditor").value;
    if (searchValue.trim() === "") {
      this.showSearchItems(searchValue.toLowerCase(), "block");
      return;
    }

    this.showSearchItems(searchValue.toLowerCase(), "none");
  }

  function showSearchItems(searchValue, display) {
    var filterList = Object.keys(this.editor.Dictionary).filter(function(key) {
      var currentDictionary = this.editor.Dictionary[key];

      if (key !== "root" && key.split(".").length === 2 && currentDictionary.display !== "none") {
        if (searchValue === "" || currentDictionary.title.toLowerCase().indexOf(searchValue) === -1) {
          this.element.querySelector("div[data-id='" + currentDictionary.dataID + "']").style.display = display;
          if (display === "block")
            return key;
        } else if (currentDictionary.title.toLowerCase().indexOf(searchValue) !== -1) {
          this.element.querySelector("div[data-id='" + currentDictionary.dataID + "']").style.display = "block";
          return key;
        }
      }
    }.bind(this));

    this.element.querySelector("#textNoResults").style.display = filterList.length === 0 ? "block" : "none";
  }

  function clearFilter(event) {
    var txtSearch = this.element.querySelector("#searcheditor");
    var searchValue = txtSearch.value;

    this.showSearchItems(searchValue.toLowerCase(), "block");
    txtSearch.value = "";
  }

  function deleteItems(event) {
    if (this.count > 1)
      UtilClass.$AddLoader.call(this, "div[items-container]");

    var itemPath = event.currentTarget.dataset.itemspath;
    var parentPath = itemPath.substr(0, itemPath.lastIndexOf("."));

    var deleteKey = itemPath.split(".").pop();

    this.element.querySelector('div[data-id="' + deleteKey + '"]').remove();

    this.count--;

    if (this.count === 0)
      this.element.querySelector("#deleteall").style.display = "none";

    // removing only current item from Dictionary so that we can create items again
    this.deleteFromDictionary(itemPath);

    // removing only current item errors from Dictionary if it is the only one
    this.removeFromArrayErrors(itemPath);

    var configuration = this.editor.getValue();

    var initialValuesPath = parentPath.replace("root.", "");
    var initialValues = UtilClass.$GetValueFromKey(initialValuesPath, configuration, ".");


    var schema = {},
      count = 0,
      newInitialValues = [];

    initialValues.forEach(function(item) {
      if (item !== undefined || item !== null) {
        schema[count] = JSON.parse(JSON.stringify(this.editor.Dictionary[parentPath].items));
        schema[count].itemsIterator = true;
        count++;
        newInitialValues.push(item);
      }
    }.bind(this));

    this.reorderItems(parentPath, newInitialValues, schema);
  };

  function moveDown(event) {
    this.togglePosition(event);
  }

  function togglePosition(event) {
    event.stopPropagation();
    UtilClass.$AddLoader.call(this, "div[items-container]")
    var whichWay = event.currentTarget.dataset.whichway;
    var itemPath = event.currentTarget.dataset.itemspath;
    var parentPath = itemPath.substr(0, itemPath.lastIndexOf("."));
    var configuration = this.editor.getValue();
    var initialValuesPath = parentPath.replace("root.", "");
    var initialValues = UtilClass.$GetValueFromKey(initialValuesPath, configuration, ".");

    var currentPosition = parseInt(itemPath.split(".").pop());
    var newPosition;

    if (whichWay === "up") {
      newPosition = currentPosition - 1;
    } else if (whichWay === "down") {
      newPosition = currentPosition + 1;
    }

    if (initialValues[newPosition] || initialValues[newPosition] === "" || initialValues[newPosition] === 0) {
      swap.call(initialValues, currentPosition, newPosition);

      var schema = {},
        count = 0;

      initialValues.forEach(function(item) {
        if (item !== undefined || item !== null) {
          schema[count] = JSON.parse(JSON.stringify(this.editor.Dictionary[parentPath].items));
          schema[count].itemsIterator = true;
          count++;
          return item;
        }
      }.bind(this));

      this.reorderItems(parentPath, initialValues, schema);
    }
  }

  function swap(indexA, indexB) {
    var temp = this[indexA];
    this[indexA] = this[indexB];
    this[indexB] = temp;
  }

  function moveUp(event) {
    this.togglePosition(event);
  }

  function reorderItems(parentPath, initialValues, schema) {
    this.eventLoop.push(function() {
      var nodes = this.element.querySelector('div[items-container]');
      nodes.innerHTML = "";
      UtilClass.$RemoveLoader.call(this, "div[items-container]");
    });

    if (!initialValues.length) {
      this.$Digest();
      UtilClass.$RemoveLoader.call(this, "div[items-container]");
      return;
    }

    // removing all item elements from Dictionary
    this.deleteFromDictionary(parentPath);

    // removing all errors from this.errors who's path starts with parent path of items array schema
    this.removeFromArrayErrors(parentPath);

    var initOptions = this.$GetInitOptions("ItemsForm", schema, initialValues, parentPath);

    this.$InitEditor(initOptions);

  }


  function deleteAllItems(event) {

    var itemPath = event.currentTarget.dataset.itemspath;
    var nodes = this.element.querySelector('div[items-container]');
    nodes.innerHTML = ""
    this.count = 0;

    event.currentTarget.style.display = "none";
    this.deleteFromDictionary(itemPath);

    // delete from array - errors
    this.removeFromArrayErrors(itemPath);

    this.$Digest();

  };

  function removeFromArrayErrors(itemPath) {
    this.errors = this.errors.filter(function(path) {
      if (path.indexOf(itemPath) === -1)
        return true
    })
  }

  function deleteFromDictionary(itemPath) {
    var dictionary = this.editor.Dictionary;

    for (var key in dictionary) {
      if (dictionary[key].path && dictionary[key].path.indexOf(itemPath) === 0 && !dictionary[key].items)
        delete this.editor.Dictionary[key];
    }

  };

  function collapse(event) {
    var toggleWell = event.currentTarget.parentElement.parentElement.nextElementSibling;
    var btn = event.currentTarget.querySelector("i");
    toggleWell = toggleWell.nodeName === "P" ? toggleWell.nextElementSibling : toggleWell;

    if (toggleWell.style.display === "block" || toggleWell.style.display === "") {
      toggleWell.style.display = "none";
      btn.classList.add("glyphicon-chevron-right");
      btn.classList.remove("glyphicon-chevron-down");
      btn.title = "Expand";
    } else {
      toggleWell.style.display = "block";
      btn.classList.remove("glyphicon-chevron-right");
      btn.classList.add("glyphicon-chevron-down");
      btn.title = "Collapse";
    }
  }

  function addItems(event) {
    var itemsPath = event.currentTarget.dataset.itemspath;
    event.currentTarget.nextElementSibling.style.display = "block";


    var configuration = this.editor.getValue();
    var initialValuesPath = itemsPath.replace("root.", "");
    var initialValues = UtilClass.$GetValueFromKey(initialValuesPath, configuration, ".");

    var schema_ = this.editor.Dictionary[itemsPath].items;
    var schema = {};
    var count = 0;


    initialValues.push(schema_.type === "object" ? {} : "");

    initialValues.forEach(function(item) {
      schema[count] = JSON.parse(JSON.stringify(schema_));
      schema[count].itemsIterator = true;
      count++;
    }.bind(this));

    this.count++;

    this.reorderItems(itemsPath, initialValues, schema);
  }


  function AddEvents() {
    this.parsedEvents = JSON.parse(JSON.stringify($Events));

    var schemaId = this.options.schemaName;
    var forHTML = "{{schemaId}}";
    var forWindow = "(event)";

    for (var key in this.parsedEvents) {
      var eventName = this.parsedEvents[key];
      this.parsedEvents[key] = eventName.replace(forHTML, schemaId);

      var originalEvent = eventName.replace(forHTML + forWindow, "");
      var windowEventName = this.parsedEvents[key].replace(forWindow, "");
      if (this[originalEvent])
        window[windowEventName] = this[originalEvent].bind(this);
    }
  }

  function handleDatePicker(event) {
    var element = event.currentTarget.nextElementSibling;

    if ((this.options.schema.disableFutureDates === true) && (element.getAttribute("data-origname") === "root.contract.startDate"))
      $(element).datepicker('change', { maxDate: new Date() });

    $(element).datepicker('show');
  }

  function Apply(currentTarget, changeValue, callback) {
    var currentDictionary = UtilClass.$GetCurrentDictionary.call(this, currentTarget.dataset.origname);

    if (changeValue)
      currentDictionary.value = currentTarget.value;

    if (callback && typeof callback === "function")
      callback.call(this, currentDictionary);

    if (currentDictionary.validations)
      ValidationsClass.validate(currentDictionary, currentTarget, this.errors, this.editor, this.element, this.options, this.$Digest.bind(this));

    if (!this.busy)
      this.$Digest();
  }


  function handleTextArea(event) {
    this.$Apply(event.currentTarget, true)
  };

  function handleCheckbox(event) {
    this.$Apply(event.currentTarget, false, function(currentDictionary) {
      currentDictionary.value = event.currentTarget.checked;

      if (currentDictionary.options && currentDictionary.options.dependencies) {
        var dependencies = currentDictionary.options.dependencies;
        var dictionaryPath = currentDictionary.path;

        dependencies.forEach(function(dependency) {
          UtilClass.$HandleDependency.call(this, dependency, currentDictionary, UtilClass, ValidationsClass);
        }.bind(this));
      }
    });
  }

  function handleSelect(event) {
    this.$Apply(event.currentTarget, true, function(currentDictionary) {
      if (currentDictionary.dataID === 'contractLength' || currentDictionary.dataID === 'contractTerm') {
        this.$ContractLengthChanged(currentDictionary);
        // ToDo :: add code for changing endDate
      }

      if (currentDictionary.options && currentDictionary.options.dependencies) {
        var dependencies = currentDictionary.options.dependencies;
        var dictionaryPath = currentDictionary.path;

        dependencies.forEach(function(dependency) {
          UtilClass.$HandleDependency.call(this, dependency, currentDictionary, UtilClass, ValidationsClass);
        }.bind(this));
      }
    })
  }



  function handleInput(event) {
    this.$Apply(event.currentTarget, true, function(currentDictionary) {
      this.handleNumericFields(currentDictionary, event.currentTarget, this.options.$locale.NUMBER_FORMATS);
    })
  }

  function handleNumericFields(currentDictionary, element, numberFormaters) {
    // type number and format = text
    // leaving field blank will set either default value or minimum value
    // entering alphabets - set either default value or minimum value
    if ((currentDictionary.type === "number" || currentDictionary.type === "integer") && currentDictionary.format === "text") {
      element.value = currentDictionary.value = UtilClass.$HandleNumberFields(currentDictionary.value, numberFormaters);

      if (isNaN(parseInt(currentDictionary.value))) {
        currentDictionary.value = currentDictionary.default !== undefined ? currentDictionary.default : 0;
        element.value = currentDictionary.value;
      } else {
        // excluding number because integer not allow decimal values
        // below code will remove decimal
        if (!isNaN(currentDictionary.value) && currentDictionary.type === "number")
          currentDictionary.value = parseFloat(currentDictionary.value);
      }
    }
  }

}, function(UtilClass) {


  /**
   * Validation for External Validation url
   */

  function ExternalValidationUrl() {};

  ExternalValidationUrl.prototype.$InitExternalValidation = InitExternalValidation;
  ExternalValidationUrl.prototype.$DisableExternalValidationElements = DisableExternalValidationElements;
  ExternalValidationUrl.prototype.$GetConfigurationNames = GetConfigurationNames;
  ExternalValidationUrl.prototype.$ValidateExternalValidation = ValidateExternalValidation;
  ExternalValidationUrl.prototype.$ExecuteEditorEvents = ExecuteEditorEvents;
  ExternalValidationUrl.prototype.$ShowExternalValidationSuccess = ShowExternalValidationSuccess;
  ExternalValidationUrl.prototype.$ShowExternalValidationErrors = ShowExternalValidationErrors;

  function InitExternalValidation(validation) {
    if (!this.Dictionary.options.externalValidation)
      return;

    var errors_ = this.errors.filter(function(error) {
      return error !== this.Dictionary.path;
    }.bind(this));

    if (errors_.length)
      return;

    var externalValidationIDs = this.editor.externalvalidationurl;

    var configurationNames = this.$GetConfigurationNames(externalValidationIDs);

    var externalvalidationurl = this.options.externalvalidationurl.url + 'validate/' + this.options.externalvalidationurl.token + '&include=' + configurationNames;

    this.errors.push("ExternalValidationUrl");
    this.$ValidateExternalValidation(externalvalidationurl, externalValidationIDs);
  };

  function DisableExternalValidationElements(dictionaryPath, disabled, message, color, displayMessage) {
    var element = this.element.querySelector("[data-origname='" + dictionaryPath + "']");
    if (element) {
      element.disabled = disabled;

      if (displayMessage) {
        var external = element.parentElement.querySelector(".external");

        message = message ? message : "";
        external.innerHTML = message;

        if (color)
          external.style.color = color;
      }
    }
  }

  function GetConfigurationNames(externalValidationIDs) {
    var that = this;

    return externalValidationIDs.map(function(dictionaryPath) {
      var Dictionary = that.editor.Dictionary[dictionaryPath];
      var displayMessage = Dictionary.value || Dictionary.value === 0 ? true : false;

      var message = displayMessage ? "Validating..." : undefined;

      that.$DisableExternalValidationElements(dictionaryPath, true, message, "#2c83ae", true);

      return dictionaryPath.replace('root', 'configuration')
    }).join(",");
  }

  function ValidateExternalValidation(validateUrl, externalValidationIDs) {
    var dfd = window.jQuery.Deferred(),
      that = this;

    this.Dictionary.asyncValidation = true;

    var dataConfiguration = {
      "specification": {
        "id": this.options.externalvalidationurl.propertyId
      },
      configuration: this.editor.getValue()
    };


    var request = window.jQuery.ajax({
      url: validateUrl,
      method: 'PUT',
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify(dataConfiguration)
    });

    request.done(function(msg) {
      if (msg.status === 200) {
        that.$ExecuteEditorEvents(true);
        that.$ShowExternalValidationSuccess(msg.info);
      }
    });

    request.fail(function(jqXHR, textStatus) {
      if (jqXHR.responseJSON && jqXHR.responseJSON.status === 400) {
        that.$ExecuteEditorEvents(false, jqXHR.responseJSON.validationErrors);
        that.$ShowExternalValidationErrors(jqXHR.responseJSON.validationErrors);
      } else if (!jqXHR.responseJSON || jqXHR.responseJSON.status === 500 || jqXHR.responseJSON.status === 502 || jqXHR.responseJSON.status === 503) {
        that.$ExecuteEditorEvents(false, jqXHR.responseJSON.validationErrors);
        that.$ShowExternalValidationErrors(['Conection error, please try again later']);
      }
    });
  };

  function ExecuteEditorEvents(isValid, errors) {
    var index = this.errors.indexOf("ExternalValidationUrl");
    this.errors.splice(index, 1);
    this.Dictionary.asyncValidation = false;

    if (errors && errors.length) {
      errors.forEach(function(item) {
        var itemspath = item.field.replace("configuration", "root");
        var element = this.element.querySelector("[data-origname='" + itemspath + "']");
        UtilClass.$ToggleError(isValid, element, this.errors);
      }.bind(this))
    }


    if (this.$Digest)
      this.$Digest();

  }

  function ShowExternalValidationSuccess(message) {
    this.editor.externalvalidationurl.forEach(function(dictionaryPath) {
      var Dictionary = this.editor.Dictionary[dictionaryPath];
      var displayMessage = Dictionary.value || Dictionary.value === 0 ? true : false;


      this.$DisableExternalValidationElements(dictionaryPath, false, message, "#819f01", displayMessage);

    }.bind(this))
  }

  function ShowExternalValidationErrors(errors) {
    this.editor.externalvalidationurl.forEach(function(dictionaryPath) {
      var configuration = dictionaryPath.replace("root", "configuration");

      var error = errors.filter(function(error) {
        return error.field === configuration;
      })

      if (error && error.length) {
        this.$DisableExternalValidationElements(dictionaryPath, false, error[0].message, "#e14d43", true);
      } else
        this.$DisableExternalValidationElements(dictionaryPath, false, undefined, undefined, true);

    }.bind(this))
  }

  /**
   * Validation for number fields
   */


  function NumberValidation() {
    ExternalValidationUrl.call(this);
  }

  UtilClass.$Inheritance(NumberValidation, ExternalValidationUrl);

  NumberValidation.prototype.$exclusiveMinimumValidation = exclusiveMinimumValidation;
  NumberValidation.prototype.$inclusiveMinimumValidation = inclusiveMinimumValidation;
  NumberValidation.prototype.$MinimumValidation = MinimumValidation;
  NumberValidation.prototype.$MaximumValidation = MaximumValidation;
  NumberValidation.prototype.$MaxLength = MaxLength;
  NumberValidation.prototype.$MinLength = MinLength;
  NumberValidation.prototype.$MultipleOf = MultipleOf;
  NumberValidation.prototype.$NumberTypeValidation = NumberTypeValidation;

  function NumberTypeValidation(validation) {
    var isValid = !isNaN(this.currentTarget.value);

    // decimals are not allowe for integer types
    if (validation.type === "integer")
      isValid = this.currentTarget.value.indexOf(".") !== -1 ? false : isValid;

    // integer fields are still string in Dictionary which is good
    if (typeof this.Dictionary.value !== "number" && isValid)
      this.Dictionary.value = parseInt(this.currentTarget.value);


    if (isValid) {
      this.currentTarget.value = UtilClass.$sanitize(this.Dictionary.value, this.options.$locale.NUMBER_FORMATS);
    }

    UtilClass.$ToggleIsValid(validation, this.currentTarget, isValid);
  }

  function exclusiveMinimumValidation(validation) {
    var isValid = this.Dictionary.value > this.Dictionary.minimum;
    UtilClass.$ToggleIsValid(validation, this.currentTarget, isValid);
  }

  function inclusiveMinimumValidation(validation) {
    return {
      minimumValue: this.schema.minimum,
      errormsg: "error_minimum_incl"
    }
  }

  function MinimumValidation(validation) {
    UtilClass.$ToggleIsValid(validation, this.currentTarget, !(this.Dictionary.value < this.Dictionary.minimum));
  }

  function MaximumValidation(validation) {
    UtilClass.$ToggleIsValid(validation, this.currentTarget, !(this.Dictionary.value > this.Dictionary.maximum));
  }

  function MaxLength(validation) {
    var isValid = this.Dictionary.value !== undefined && !(this.Dictionary.value.length > validation.maxLength)
    UtilClass.$ToggleIsValid(validation, this.currentTarget, isValid);
  }

  function MinLength(validation) {
    UtilClass.$ToggleIsValid(validation, this.currentTarget, this.Dictionary.value !== undefined && !(this.Dictionary.value.length < validation.minLength));
  }

  function MultipleOf(validation) {
    var isValid = this.Dictionary.multipleOf && (window.math.mod(window.math.bignumber(this.Dictionary.value), window.math.bignumber(this.Dictionary.multipleOf)).equals(0))
    UtilClass.$ToggleIsValid(validation, this.currentTarget, isValid);
  };

  /**f
   * Validation for string fields
   */

  function StringValidation(schema, dictionary) {
    NumberValidation.call(this);
  }

  UtilClass.$Inheritance(StringValidation, NumberValidation);

  StringValidation.prototype.requiredValidation = requiredValidation;
  StringValidation.prototype.patternValidation = patternValidation;
  StringValidation.prototype.emailValidation = emailValidation;

  function requiredValidation(validation, isAnyOf) {
    if (isAnyOf) {
      switch (validation.type) {
        case "equal":
          validation.isValid = this.Dictionary.value === validation.value;
          break;
      }
    } else {
      var isValid = checkedRequiredByType(this.Dictionary);
      UtilClass.$ToggleIsValid(validation, this.currentTarget, isValid);
    }
  }

  function checkedRequiredByType(Dictionary) {
    var isValid;

    if (Dictionary.requiredToggle) {
      if (!Dictionary.isRequired)
        isValid = true;
      else if (Dictionary.isRequired)
        isValid = getValid(Dictionary);
    } else {
      isValid = getValid(Dictionary);
    }
    return isValid;
  }


  function getValid(Dictionary) {
    var value = Dictionary.value;

    if (Dictionary.minimum === 0 && !Dictionary.exclusiveMinimum) {
      return value ? true : false
    }

    if (Dictionary.type === "number" && Dictionary.type === "integer" && Dictionary.minimum !== undefined)
      return value ? true : false;
    else if (Dictionary.type === "boolean")
      return typeof value !== "undefined" ? true : false;
    else
      return value || value === 0 ? true : false;

  }

  function patternValidation(validation) {
    if (this.Dictionary.value || this.Dictionary.value == "") {
      UtilClass.$ToggleIsValid(validation, this.currentTarget, new RegExp(validation.pattern).test(this.Dictionary.value));
    } else {
      UtilClass.$ToggleIsValid(validation, this.currentTarget, false);
    }
  }

  function emailValidation(validation) {
    UtilClass.$ToggleIsValid(validation, this.currentTarget, validation.pattern.test(this.Dictionary.value));
  }

  /**
   * AnyOf Class
   */

  function AnyOf() {
    StringValidation.call(this);
  }

  UtilClass.$Inheritance(AnyOf, StringValidation);

  AnyOf.prototype.$AnyOfValidation = AnyOfValidation;
  AnyOf.prototype.$AnyOfParser = AnyOfParser;

  function AnyOfValidation(validation) {
    validation.isValid = false;

    validation.conditions.forEach(function(childValidation) {
      if (childValidation.type === "emailpattern")
        this.emailValidation(childValidation);
      else if (childValidation.type === "equal")
        this.$AnyOfParser(childValidation, true);
      else if (childValidation.type === "pattern")
        this.patternValidation(childValidation);

      if (childValidation.isValid)
        validation.isValid = true;

    }.bind(this));

    UtilClass.$ToggleIsValid(validation, this.currentTarget, validation.isValid);
  }


  function AnyOfParser(item) {
    if (item.value === "")
      this.requiredValidation(item, true);
  }

  /**
   * ValidationsClass:- Validates the editor
   */


  function ValidationsClass(Dictionary, currentTarget, errors, editor, element, options, Digest) {
    this.Dictionary = Dictionary,
      this.currentTarget = currentTarget,
      this.editor = editor,
      this.errors = errors,
      this.element = element,
      this.options = options,
      this.$Digest = Digest;


    AnyOf.call(this);
  };

  UtilClass.$Inheritance(ValidationsClass, AnyOf);

  ValidationsClass.prototype.$Validate = ValidateEditor;
  ValidationsClass.prototype.$ExecuteValidations = ExecuteValidations;

  return {
    validate: function(Dictionary, currentTarget, errors, editor, element, options, Digest) {
      var validation = new ValidationsClass(Dictionary, currentTarget, errors, editor, element, options, Digest);
      return validation.$Validate();
    }
  };

  function ValidateEditor() {
    this.Dictionary.isValid = true;

    for (var i = 0; i < this.Dictionary.validations.length; i++) {
      if (this.Dictionary.isValid)
        this.$ExecuteValidations(this.Dictionary.validations[i]);
      else
        UtilClass.$ToggleIsValid(this.Dictionary.validations[i], this.currentTarget, true);
    }


    if (this.editor.multipleDependency) {
      var parentPath = this.Dictionary.path.substr(0, this.Dictionary.path.lastIndexOf("."))
      var parentDictionary = this.editor.Dictionary[parentPath];

      var isValid = parentDictionary.display === "block" && this.Dictionary.display === "block" ? this.Dictionary.isValid : true;
      UtilClass.$ToggleError(isValid, this.currentTarget, this.errors);
    } else
      UtilClass.$ToggleError(this.Dictionary.isValid, this.currentTarget, this.errors);
  }

  function ExecuteValidations(validation) {
    switch (validation.type) {
      case 'required':
        this.requiredValidation(validation);
        break;
      case 'pattern':
        this.patternValidation(validation);
        break;
      case 'number':
      case 'integer':
        this.$NumberTypeValidation(validation);
        break;
      case 'emailpattern':
        this.emailValidation(validation);
        break;
      case 'maxLength':
        this.$MaxLength(validation);
        break;
      case 'minLength':
        this.$MinLength(validation);
        break;
      case 'minimum':
        this.$MinimumValidation(validation);
        break;
      case 'maximum':
        this.$MaximumValidation(validation);
        break;
      case 'exclusiveMinimum':
        this.$exclusiveMinimumValidation(validation);
        break;
      case 'anyOf':
        this.$AnyOfValidation(validation);
        break;
      case 'external':
        this.$InitExternalValidation(validation);
        break;
      case 'multipleOf':
        this.$MultipleOf(validation);
        break;
    }

    if (!validation.isValid)
      this.Dictionary.isValid = false;
  };

}, function() {
  /**
   * UtilClass:- consists generic functions
   */

  return {
    $GetWebWorkerFile: function(callback) {
      // development mode using: foreman start -f Procfile.dev
      var devHost = 'app/Async-Editor/dist/webworker.js'

      // start server normally using: foreman start
      // var devHost = 'webworker/webworker.js'

      var url = location.hostname === "localhost" ? devHost : 'webworker/webworker.js',
        that = this;

      var webworkerURL = location.origin + location.pathname + url;

      var xmlhttp;
      if (window.XMLHttpRequest) {
        xmlhttp = new XMLHttpRequest();
      } else {
        // code for older browsers
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
      }
      xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          that.$CreateBlobFile(this.responseText, callback)
        }
      };
      xmlhttp.open("GET", webworkerURL, true);
      xmlhttp.send();
    },
    $CreateBlobFile: function(script, callback) {
      window.URL = window.URL || window.webkitURL;
      var blob;
      try {
        blob = new Blob([script], { type: 'application/javascript' });
      } catch (e) { // Backwards-compatibility
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
        blob = new BlobBuilder();
        blob.append(script);
        blob = blob.getBlob();
      }

      if (callback && typeof callback === "function")
        return callback(URL.createObjectURL(blob));
    },
    $ToggleDepenency: function(valueMatched, editor, currentDictionary, dependencyAttr, element, dependencyDictionary) {
      if (valueMatched) {
        if (editor.Dependencies[dependencyAttr].indexOf(currentDictionary.path) === -1 && editor.multipleDependency) {
          editor.Dependencies[dependencyAttr].push(currentDictionary.path);
        }
      } else {
        if (editor.Dependencies[dependencyAttr].indexOf(currentDictionary.path) !== -1 && editor.multipleDependency)
          editor.Dependencies[dependencyAttr].splice(editor.Dependencies[dependencyAttr].indexOf(currentDictionary.path), 1);

        if (!editor.Dependencies[dependencyAttr].length) {
          this.$ToggleHidden("div[data-id='" + dependencyAttr + "']", element, "none", dependencyDictionary);
        }
      }
    },
    $HandleDependency: function(dependency, currentDictionary, UtilClass, ValidationsClass) {
      var dependencyAttr = dependency.depId || dependency.id;

      var element = this.element.querySelector('div[data-id="' + dependencyAttr + '"]'),
        labelElement = $(element).find('.control-label'),
        inputElement = $(element).find('.form-control');

      if (element) {
        var dependencyPath = element.children[0].dataset.schemapath;
        var dependencyDictionary = this.editor.Dictionary[dependencyPath];

        var valueMatched = UtilClass.$TestDependency(currentDictionary, dependency);

        if (valueMatched) {
          if (this.editor.multipleDependency)
            UtilClass.$ToggleDepenency(valueMatched, this.editor, currentDictionary, dependencyAttr, this.element, dependencyDictionary);

          UtilClass.$ToggleHidden("div[data-id='" + dependencyAttr + "']", this.element, "block", dependencyDictionary);
        } else if (!dependency.show) {
          if (this.editor.multipleDependency) {
            UtilClass.$ToggleDepenency(valueMatched, this.editor, currentDictionary, dependencyAttr, this.element, dependencyDictionary);
          } else
            UtilClass.$ToggleHidden("div[data-id='" + dependencyAttr + "']", this.element, "none", dependencyDictionary);
        }

        UtilClass.$RequiredValidation(dependency, valueMatched, labelElement, UtilClass.$TranslateText.bind(this.options.translations), dependencyDictionary);
        UtilClass.$DisableValidation(dependency, valueMatched, inputElement, dependencyDictionary);

        UtilClass.$SetDefaultsToChildElements(dependencyDictionary, inputElement, this, ValidationsClass);
      }
    },
    $SetDefaultsToChildElements: function(dependencyDictionary, inputElement, editor, ValidationsClass) {
      for (var i = 0; i < inputElement.length; i++) {
        var element = inputElement[i];
        var childPaths = element.dataset.origname;
        var childDictionary = this.$GetCurrentDictionary.call(editor, childPaths);

        // setting initialValues to element and Dictionary again
        // if initialValues are not found then using default values
        if (childDictionary.initialValue !== undefined)
          element.value = childDictionary.initialValue;
        else if (!editor.editor.multipleDependency) {
          if (childDictionary.default !== undefined)
            element.value = childDictionary.default;
          else if (childDictionary.type === "string")
            element.value = "";
        }

        if (editor.editor.multipleDependency && !editor.editor.Dependencies[dependencyDictionary.dataID].length) {
          if (childDictionary.default !== undefined)
            element.value = childDictionary.default;
          else if (childDictionary.type === "string")
            element.value = "";
        }


        childDictionary.value = element.value;

        if (childDictionary.validations && childDictionary.validations.length)
          ValidationsClass.validate(childDictionary, element, editor.errors, editor.editor, editor.element, editor.options, editor.$Digest.bind(editor));

        if (element.nodeName === "SELECT" && childDictionary.dependenciesAttribute && element.onchange) {
          editor.busy = true;
          element.onchange({ "currentTarget": element });
          editor.busy = false;
        }
      }
    },
    $RequiredValidation: function(dependency, valueMatched, labelElement, translate, dependencyDictionary) {

      if (dependency.requiredToggle && !valueMatched) {
        dependencyDictionary.isRequired = false;

        var optionalElement = labelElement && labelElement[0] && labelElement[0].querySelector("#isoptional");
        if (optionalElement) {
          optionalElement.textContent = translate('optional', 'Errors');
          optionalElement.style.color = "";
          optionalElement.style.marginLeft = "0";
        }
      } else
      if (dependency.requiredToggle && valueMatched) {
        dependencyDictionary.isRequired = true;

        var optionalElement = labelElement && labelElement[0] && labelElement[0].querySelector("#isoptional");
        if (optionalElement) {
          optionalElement.textContent = "*";
          optionalElement.style.color = "red";
          optionalElement.style.marginLeft = "6px";
        }
      }
    },
    $DisableValidation: function(dependency, valueMatched, inputElement, currentDictionary) {

      if ((dependency.disableToggle && (inputElement.attr('disabled') === false || inputElement.attr('disabled') === undefined)) && !valueMatched) {

        if (!dependency.fullPath || dependency.fullPath.indexOf('.') === -1) {
          if (currentDictionary.type === 'string') {
            inputElement.val('');
            currentDictionary.value = ''
          }
        } else {
          if (currentDictionary.type === 'string') {
            var defaultValue = currentDictionary.default;
            inputElement.val(defaultValue ? defaultValue : '');
            if (currentDictionary.onInputChange) {
              currentDictionary.onInputChange();
            }
            currentDictionary.value = defaultValue ? defaultValue : '';
            if (currentDictionary.change) {
              currentDictionary.change();
            }

          }
        }

        inputElement.attr('disabled', 'disabled');
      } else if ((dependency.disableToggle && inputElement.attr('disabled') === 'disabled') && valueMatched) {
        inputElement.removeAttr('disabled');
      }

    },
    $TestDependency: function(currentDictionary, dependency) {
      var valueMatched;


      if (dependency.pattern) {
        valueMatched = testByPattern();
      } else {
        valueMatched = testByValue();
      }

      return valueMatched;

      function isRegExMatch(pattern, value) {
        return new RegExp(pattern).test(value);
      }

      function testByPattern() {
        var valueMatched;

        if (dependency.pattern.length && dependency.pattern instanceof Array) {
          for (var i = 0; i < dependency.pattern.length; i++) {
            if (!isRegExMatch(dependency.pattern[i], currentDictionary.value)) {
              valueMatched = false;
              break;
            } else
              valueMatched = true;
          }
        } else
          valueMatched = isRegExMatch(dependency.pattern, currentDictionary.value);

        return valueMatched;
      }

      function testByValue() {
        var valueToCheck = dependency.value || '',
          valuesToCheck = dependency.values || [];

        return (valueToCheck || valueToCheck === "") && currentDictionary.value === valueToCheck || (valuesToCheck && valuesToCheck.indexOf(currentDictionary.value) != -1)
      }
    },
    $ToggleHidden: function(selector, container, display, currentDictionary) {
      var targetElement = container.querySelector(selector);

      if (targetElement) {
        display === "none" ? $(targetElement).hide(0) : $(targetElement).show(0);
        currentDictionary.display = display;
      } else
        console.log(selector, "--------not found");
    },
    $AddLoader: function(loadingContainerId) {
      if (this.options.loadingClass)
        this.element.querySelector(loadingContainerId).classList.add(this.options.loadingClass);
    },
    $RemoveLoader: function(loadingContainerId) {
      if (this.options.loadingClass)
        this.element.querySelector(loadingContainerId).classList.remove(this.options.loadingClass);
    },
    $on: function(eventName, callback) {
      this[eventName] = callback;
    },
    $Inheritance: function(ParentClass, ChildClass) {
      ParentClass.prototype = Object.create(ChildClass.prototype);
      ParentClass.prototype.constructor = ParentClass;
    },
    $Translations: function() {
      return {
        errorTranslations: this.options.translations.errorTranslations,
        productSchemaTranlations: this.options.translations.productSchemaTranlations,
        keysToTranslate: [{
          key: 'title',
          type: 'string'
        }, {
          key: 'description',
          type: 'string'
        }, {
          key: 'enum_titles',
          type: 'array',
          path: 'options.enum_titles'
        }, {
          key: 'tooltip',
          type: 'string',
          path: 'options.tooltip'
        }]
      }
    },
    $getValue: function() {
      var initialValues = {};

      for (var key in this.editor.Dictionary) {
        if (key === "root")
          continue;

        var element = this.editor.Dictionary[key];

        key = key.split(".").splice(1);
        var count = 0;

        function nextValue(key_, initialValues) {
          if (!initialValues[key_]) {
            if (element.type === "object") {
              initialValues[key_] = {};

              if (count < key.length - 1)
                nextValue(key[++count], initialValues[key_]);
            } else
            if (element.type === "array") {
              initialValues[key_] = [];

              if (count < key.length - 1)
                nextValue(key[++count], initialValues[key_]);

            } else {
              initialValues[key_] = element.value;
            }
          } else {
            nextValue(key[++count], initialValues[key_]);
          }
        }

        nextValue(key[count], initialValues);
      }

      return initialValues;
    },
    $GetCurrentDictionary: function(path) {
      return this.editor.Dictionary[path];
    },
    $ToggleIsValid: function(validation, currentTarget, isValid) {
      validation.isValid = isValid;
      var errorTypeSpan = currentTarget.parentElement.querySelector("#" + validation.type);

      if (errorTypeSpan)
        errorTypeSpan.style.display = isValid ? "none" : "inline";
    },
    $ToggleError: function(isValid, currentTarget, errors) {
      var pathName = currentTarget.dataset.origname;
      var position = errors.indexOf(pathName);

      // remove external validation error when field is empty
      if (currentTarget.dataset && currentTarget.dataset.externalValidation && !currentTarget.value)
        currentTarget.parentElement.querySelector(".external").innerText = "";

      if (isValid) {
        this.$HideError(currentTarget);
        if (position !== -1)
          errors.splice(position, 1);

      } else {
        this.$ShowError(currentTarget);
        if (position === -1)
          errors.push(pathName);
      }
    },
    $HideError: function(currentTarget) {
      currentTarget.parentElement.classList.remove("has-error");
    },
    $ShowError: function(currentTarget) {
      currentTarget.parentElement.classList.add("has-error");
    },
    $GetValueFromKey: function(path, object, seperator) {
      var paths = path.split(seperator);

      paths.forEach(function(key) {
        if (object)
          object = object[key];
      });

      return object;
    },
    $sanitize: function(value, numberFormaters) {
      value = value + "";

      //remove all characters
      var decimal_sep = numberFormaters.DECIMAL_SEP || '.';
      var group_sep = numberFormaters.GROUP_SEP || ',';
      var reg = new RegExp('[^0-9 | ^' + decimal_sep + group_sep + ']', 'g');
      value = value.replace(reg, '');

      // we are using a diferent decimal separator diferent to dot(.)
      if (decimal_sep !== '.') {
        //if value by user contains this decimal separator, we change to dot
        if (value.match('^[0-9]*[' + decimal_sep + '][0-9]+$') !== null) {
          value = value.replace(decimal_sep, '.');
        }

        var tmpValue = value;
        tmpValue = tmpValue.split(".");
        switch (tmpValue.length) {
          case 2:
            tmpValue[0] = tmpValue[0].replace(',', group_sep);
            tmpValue[1] = tmpValue[1].replace(',', group_sep);
            tmpValue = tmpValue.join(decimal_sep);
            break;
          case 1:
            tmpValue = tmpValue[0].replace(',', group_sep);
            break;
          default:
            tmpValue = value;
            break;
        }

        value = tmpValue;
      }

      return value;
    },
    $HandleNumberFields: function(value, numberFormaters, element) {
      if (numberFormaters.DECIMAL_SEP !== ".") {
        return value.replace(numberFormaters.DECIMAL_SEP, '.');
      }

      return value;
    },
    $TranslateText: function(key, whichTranslation) {
      var tranlatedText;
      switch (whichTranslation) {
        case 'Errors':
          tranlatedText = this.errorTranslations[key];
          break;
      }
      return tranlatedText || key;
    }
  };
});
