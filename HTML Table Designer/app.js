//============================================================================
// Author: C. Drozdowski. MIT license.
//
// Main object used to control HTML/Javascript components of App.
// This file instantiates it automatically.
// To use it, call App.create();
//============================================================================
var App = {

//====================
// Private properties.
//====================

isResetting: false,
blockLivePreview: false,
colorControlUpdateFunc: null, //function(el, color){},
defaultName: "untitled",

//=================
// Private methods.
//=================

// Initializes the object.
init: function()
{
	// Refers to App object.
	var self = this,
		settings = {};

	settings = self.loadSettings();

	self.buildStyleSelect(self.loadStyleList());

	$('legend').on('click', function(evt) {
		var $this = $(this);
		$this.next('div').toggle(250);
		if ($this.hasClass('closed'))
			$this.removeClass('closed');
		else
			$this.addClass('closed')
	});

	$('#sel-styles').on('change', function(evt){
		self.blockLivePreview = true;
		self.onSelectStyle(evt);
		self.blockLivePreview = false;
		self.previewStyle();
	});

	// Hide #btn-preview since we now have live preview
	// but leave event in place.
	$('#btn-preview').hide();
	$('#btn-preview').on('click', function(evt){
		self.previewStyle();
	});

	$('#btn-export').on('click', function(evt){
		self.exportStyle();
	});

	$('#btn-import').on('click', function(evt){
		self.blockLivePreview = true;
		self.importStyle();
		self.blockLivePreview = false;
		self.previewStyle();
	});

	$('#btn-copy').on('click', function(evt){
		self.copyStyle();
	});

	$('#btn-save').on('click', function(evt){
			result = self.saveStyle(),
			list = [];

		if (result.length > 0)
		{
			list = self.loadStyleList();
			self.buildStyleSelect(list, result);
		}
	});

	$('#btn-close').on('click', function(evt){
		self.close();
	});

	// Before assigning change events below.
	$('div[data-css-property="font-family"] select').each(function(){
		var fonts = {};
		if (settings.hasOwnProperty('fonts'))
			fonts = settings.fonts;
		self.blockLivePreview = true;
		self.buildFontSelect(this, settings.fonts);
		self.blockLivePreview = false;
	});

	$('input[data-enabler]').on('change', function(evt){
		self.onEnableChange(evt);
		if (!self.blockLivePreview)
			self.previewStyle();
	});

	$('*[data-value]').on('change', function(evt){
		self.onValueChange(evt);
		if (!self.blockLivePreview)
			self.previewStyle();
	});

	// Windows 16 color.
	var swatches = ['#ffffff','#c0c0c0','#808080','#000000','#ff0000','#800000','#ffff00','#808000',
					'#00ff00','#008000','#00ffff','#008080','#0000ff','#000080','#ff00ff'];

	$('input.color-ctrl-bottom[type="color"]').minicolors({
		control: 'hue',
		format: 'hex',
		//defaultValue: '#000000',
		position: 'bottom',
		letterCase: 'lowercase',
		swatches: swatches,
	});

	$('input.color-ctrl-top[type="color"]').minicolors({
		control: 'hue',
		format: 'hex',
		//defaultValue: '#000000',
		position: 'top',
		letterCase: 'lowercase',
		swatches: swatches
	});

	$('input[type="color"]').on('paste', function(evt){
		if (window.clipboardData && window.clipboardData.getData)
		{
			var data = window.clipboardData.getData('Text');

			this.selectionStart = 0;
			this.selectionEnd = this.value.length;
			if (data.charAt(0) !== '#')
				data = '#' + data;

			window.clipboardData.setData('Text', data);
		}
	});

	$('.popdown').popdown(self.getIntro(), {width:550});

	self.colorControlUpdateFunc = function(el, color) {
		$(el).minicolors('value', {color: color});
	};

	// For some reason, jQuery event mechanism doesn't work right with drag
	// and drop (at least for me). not worth taking time to figure out.
	window.addEventListener('dragover', function(evt){
		evt.stopPropagation();
		evt.preventDefault();
		evt.dataTransfer.dropEffect = 'copy';
	}, false);

	window.addEventListener('drop', function(evt){
		evt.stopPropagation();
		evt.preventDefault();

		var files = evt.dataTransfer.files;
		if (!files || files.length === 0 || files[0].type !== 'text/css')
			return false;

		reader = new FileReader();
		reader.onload = function (e) {
			// Result is contents of dropped file.
			if (e.target.result && e.target.result.length > 0)
			{
				self.blockLivePreview = true;
				self.importStyle(e.target.result);
				self.blockLivePreview = false;
				self.previewStyle();
			}

			return false;
		};

		reader.readAsText(files[0]);

	}, false);

	self.blockLivePreview = true;
	self.resetUi(true);
	self.blockLivePreview = false;
	self.previewStyle();

},


//-----------------------
// UI interation methods.
//-----------------------

buildStyleSelect: function(list, name)
{
	var self = this,
		select = document.getElementById('sel-styles'),
		count = select.options.length,
		option;

	if (typeof name !== 'string' || name.length === 0)
		name = 'New';

	for (var i = (count - 1); i >= 0; i--)
	{
		select.removeChild(select.options[i]);
	}

	option = document.createElement('option');
	option.value = 'New';
	option.appendChild(document.createTextNode('New'));
	select.appendChild(option);

	for (var i = 0; i < list.length; i++)
	{
		var item = list[i];

		option = document.createElement('option');
		option.value = item;
		option.appendChild(document.createTextNode(item));

		if (item === name)
			option.setAttribute('selected', true);

		select.appendChild(option);
	}
},

buildFontSelect: function(select, fonts)
{
	var self = this,
	count = select.options.length,
	option,
	first = true;

	for (var i = 0; i < count; i++)
	{
		select.removeChild(select.options[i]);
	}

	for (var font in fonts)
	{
		if (!fonts.hasOwnProperty(font))
			continue;

		option = document.createElement('option');
		option.value = font;
		option.appendChild(document.createTextNode(fonts[font]));
		select.appendChild(option);

		if (first)
		{
			option.selected = true;
			select.setAttribute('data-value', font);
			first = false;
		}
	}
},

enableControls: function(group, enable)
{
	var self = this,
		ctrls = group.querySelectorAll('*[data-control]');

	for (var i = 0; i < ctrls.length; i++)
	{
		var ctrl = ctrls[i];

		if (!ctrl.hasAttribute('data-enabler'))
		{
			ctrl.disabled = !enable;
			ctrl.style.opacity = (enable ? 1 : 0.5);
		}
	}
},

getCtrlGroup: function(ctrl)
{
	var self = this,
		group,
		el = ctrl,
		i = 5; // Go up at most 5 parents.

	while (i >= 0)
	{
		el = el.parentNode;
		if (el.hasAttribute('data-css-selector'))
		{
			group = el;
			break;
		}
		i--;
	}

	return group;
},

resetUi: function(firstTime)
{
	var self = this,
		els = document.querySelectorAll('*[ data-control]');

	firstTime = firstTime | false;

	self.isResetting = true;

	for (var i = 0; i< els.length; i++)
	{
		var el = els[i],
			group = self.getCtrlGroup(el);

		if (!group)
			continue;

		// First uncheck enabler checkbox and disable controls associated with it.
		if (el.hasAttribute('data-enabler'))
		{
			el.checked = false;
			self.enableControls(group, false);
			continue;
		}

		// Now initialize each control value.
		// If resetting for first time, copy data-value to data-initial
		// and assign data-value to element value.
		// If not first time, copy value from data-initial to
		// data-value and element value.
		if (el.hasAttribute('data-value'))
		{
			if (firstTime)
			{
				var value = el.getAttribute('data-value');
				el.setAttribute('data-initial', value);
				el.value = value;
			}
			else if (el.hasAttribute('data-initial'))
			{
				var value = el.getAttribute('data-value');
				el.setAttribute('data-initial', value);
				el.value = value;
			}

			self.updateValueDisplay(el);
		}
	}

	if (typeof self.colorControlUpdateFunc === 'function')
	{
		var colorEls = document.querySelectorAll('input[type="color"]');
		for (var i = 0; i < colorEls.length; i++)
		{
			var el = colorEls[i];
			self.colorControlUpdateFunc(el, el.value);
		}
	}

	self.isResetting = false;
},

updateValueDisplay: function(el)
{
	var self = this,
		value = el.value,
		units = el.getAttribute('data-units'),
		span = el.nextElementSibling;

	if (units.length > 0 && span && span.className === 'val-display')
		span.innerText = '' + value + units;
},


//-----------------------------------------
// UI Event listeners.
//-----------------------------------------

onSelectStyle: function(evt)
{
	// Refers to App object. Since this is an event, use App not this.
	var self = App,
		ctrl = evt.target,
		option = ctrl.options[ctrl.selectedIndex],
		value = option.value,
		css;

	if (value.length === 0)
		return;

	css = self.loadStyle(value);

	self.cssToUi(css);
},

onEnableChange: function(evt)
{
	// Refers to App object. Since this is an event, use App not this.
	var self = App,
		ctrl = evt.target,
		checked = ctrl.checked,
		group = self.getCtrlGroup(ctrl);

	if (group)
		self.enableControls(group, checked);
},

onValueChange: function(evt)
{
	// Refers to App object. Since this is an event, use App not this.
	var self = App;

	if (self.isResetting)
	{
		evt.preventDefault();
		return false;
	}

	var el = evt.target,
		value = el.value;

	el.setAttribute('data-value', value);
	self.updateValueDisplay(el);
},


//---------------------------------------------------------
// Methods for converting from CSS to UI controls and back.
//---------------------------------------------------------

getAllowedJsStyles: function()
{
	var self = this,
		containers = document.querySelectorAll('div[data-js-property]'),
		allowed = {};

	for (var i = 0; i < containers.length; i++)
	{
		var selector = containers[i].getAttribute('data-css-selector'),
			property = containers[i].getAttribute('data-js-property');

		if (!allowed.hasOwnProperty(selector))
			allowed[selector] = [];

		allowed[selector].push(property);
	}

	return allowed;
},

uiToCss: function()
{
	var self = this,
		containers = document.querySelectorAll('div[data-css-property]'),
		cssObj = {},
		lines = [],
		css;

	/*
	First we assemble an object similar to:
		cssObj = {
			'table.origin-table' : [{'border-collapse': 'collapse'},{'border': '1px solid blue'},...],
			'table.origin-table th' : [{'text-align': 'center'},{'background-color': 'white'},...],
			...
		}
	This helps group multiple properties under one selector.
	*/
	for (var i = 0; i < containers.length; i++)
	{
		var container = containers[i],
			selector = container.getAttribute('data-css-selector'),
			property = container.getAttribute('data-css-property'),
			// Custom controls may alter children. So user qSA.
			//children = container.children,
			children = container.querySelectorAll('*[data-control]'),
			values = [],
			obj = {},
			value,
			units = '';

		if (!cssObj.hasOwnProperty(selector))
			cssObj[selector] = [];


		for (var j = 0; j < children.length; j++)
		{
			var child = children[j];

			if (child.hasAttribute('data-enabler') && !child.checked)
				break;

			if (child.hasAttribute('data-value'))
			{
				units = child.getAttribute('data-units');
				value = child.getAttribute('data-value');

				if (units.length > 0)
					value = self.stripUnits(value, units) + units;

				values.push(value);
			}
		}

		obj[property] = values.join(' ').trim();

		cssObj[selector].push(obj);
	}

	// Now iterate each member of the above object assembling
	// lines of css into an array.
	for (var selector in cssObj)
	{
		if (!cssObj.hasOwnProperty(selector))
			continue;

		// Open the selector.
		lines.push(selector + ' {');

		// Iterate the array of objects that is the value
		// for the current key.
		for (var i = 0; i < cssObj[selector].length; i++)
		{
			var obj = cssObj[selector][i];
			for (var property in obj)
			{
				if (!obj.hasOwnProperty(property) )
					continue;

				if (obj[property].length > 0)
					lines.push('\t' + property + ': ' + obj[property] + ';');
			}
		}

		// Close the selector.
		lines.push('}\n');
	}

	// Finally join the array of css lines into a string and return.
	css = lines.join('\n');
	return css;
},

cssToUi: function(css)
{
	// Believe it or not, this is the simplest method
	// for extracting styles. Perhaps not the most efficient,
	// but beats the heck out of a bunch of buggy regexes.
	var self = this,
		doc = document.implementation.createHTMLDocument(''),
		style = document.createElement('style'),
		allowed = self.getAllowedJsStyles(),
		rules;

	// Define event so change can be called for each control being set.
	var ctrlChangeEvent = document.createEvent('HTMLEvents');
	ctrlChangeEvent.initEvent('change', true, true);

	self.resetUi();

	style.textContent = css;
	doc.body.appendChild(style);
	rules = style.sheet.cssRules;

	for (var i = 0; i < rules.length; i++)
	{
		var rule = rules[i],
			selector = rule.selectorText,
			style = rule.style;

		if (!allowed.hasOwnProperty(selector))
			continue;

		for (var prop in style)
		{
			var values = style[prop],
				items,
				el,
				children,
				subValues;

			if ((typeof values !== 'string') || (values.length === 0) || (allowed[selector].indexOf(prop) === -1))
				continue;

			items = self.splitProps(style[prop], /\s/g);
			el = document.querySelector('div[data-css-selector="' + selector + '"][data-js-property="' + prop + '"]');
			if (!el)
				continue;

			values = self.splitProps(values, /\s/g);

			// Custom controls may alter children. So user qSA.
			//children = el.children;
			children = el.querySelectorAll('*[data-control]');

			for (var x = 0; x < children.length; x++)
			{
				var child = children[x],
					indices,
					units;

				if (child.hasAttribute('data-enabler'))
				{
					child.checked = true;
					self.enableControls(el, true);
				}
				else if (child.hasAttribute('data-value'))
				{
					indices = child.getAttribute('data-index');
					units = child.getAttribute('data-units');

					subValues = self.getItemsFromIndices(values, indices);
					for (var j = 0; j <subValues.length; j++)
					{
						subValues[j] = self.stripUnits(subValues[j], units, true);
					}

					child.value = subValues.join(' ').trim();
					child.dispatchEvent(ctrlChangeEvent) // Fires change event for the child.;
				}
			}
		}
	}

	// Convert rgb or named colors to hex.
	var colorEls = document.querySelectorAll('input[type="color"]');
	for (var i = 0; i < colorEls.length; i++)
	{
		var el = colorEls[i],
			value = el.value;

		if (value.indexOf('rgb') === 0)
			value = self.rgbStrToHex(value);
		else if (value.indexOf('#') < 0)
			value = self.namedColorToHex(value);

		el.value = value;

		if (typeof self.colorControlUpdateFunc === 'function')
			self.colorControlUpdateFunc(el, value);
	}
},


//------------------------------------------------
// Methods to load, save, preview, etc. style data.
//------------------------------------------------

getDefaultStyleName: function()
{
	var self = this,
	select = document.getElementById('sel-styles');

	return select.options[select.selectedIndex].value;
},

loadStyleList: function()
{
	var self = this,
		list = [],
		obj = JSON.parse(window.external.ExtCall('LoadStyleList'));

	if (obj.hasOwnProperty('styles') && Array.isArray(obj.styles))
		list = obj.styles;

	return list;
},

loadStyle: function(name)
{
	var self = this,
		css;

	css = window.external.ExtCall('LoadStyle', name);

	return css;
},

saveStyle: function()
{
	var self = this,
		css = self.uiToCss(),
		name = self.defaultName,//self.getDefaultStyleName(),
		result;

	result = window.external.ExtCall('SaveStyle', name, css);

	// Returns empty string if not saved. Otherwise returns saved name.
	// Might be different from name param passed into function.
	return result;
},

previewStyle: function()
{
	var self = this,
		css = self.uiToCss();

	return window.external.ExtCall('PreviewStyle', css); // Returns boolean.
},

exportStyle: function()
{
	var self = this,
		css = self.uiToCss(),
		name = self.defaultName;//self.getDefaultStyleName();

	return window.external.ExtCall('ExportStyle', name, css); // Returns boolean.
},

importStyle: function(css)
{
	var self = this,
		select = document.getElementById('sel-styles');

	if (typeof css !== 'string')
		css = window.external.ExtCall('ImportStyle'); // Returns string.

	if (css.length > 0)
	{
		select.selectedIndex = 0;
		self.cssToUi(css);
	}
},

copyStyle: function()
{
	var self = this,
		css = self.uiToCss();

	return window.external.ExtCall('CopyStyle', css); // Returns boolean.
},


//---------------
// Other methods.
//---------------

getIntro: function()
{
	var self = this,
		intro = window.external.ExtCall('GetIntro');

	return intro;
},

loadSettings: function()
{
	var self = this,
		settings = JSON.parse(window.external.ExtCall('LoadSettings'));

	return settings;
},

saveSettings: function(settings)
{
	var self = this;

	window.external.ExtCall('SaveSettings', JSON.stringify(settings));
},

close: function()
{
	window.external.ExtCall('CloseClick');
},

// Units will only be after a digit.
stripUnits: function(value, units, convert)
{
	var num = parseFloat(value),
		matches;

	if (!isFinite(num) || isNaN(num))
		return value;

	if (units.length === 0 || !convert)
		return '' + num;

	matches = value.match(/(px|pt|rem|em|\%)/);

	if (matches && matches.length > 0)
	{
		switch (matches[0])
		{
			case 'pt':
				num = (4.0 * num) / 3.0;
				break;
			case 'rem':
			case 'em':
				num = 16.0 * num;
				break;
			case '%':
				num = 16.0 * (num / 100);
				break;
			default: // px and other.
				break;
		}
	}

	// Fix to allow fractional units.
	//return '' + Math.round(num);
	return num.toFixed(2);
},

// Returns an array of items from arr whose indices
// are items in the indices array.
getItemsFromIndices: function(arr, indices)
{
	for (var i = 0; i < indices.length; i++)
	{
		indices[i] = indices[i] | 0;
	}

	var ret = arr.filter(function(item, index){
		return indices.indexOf(index) > -1;
	});

	return ret;
},

/*
var arr1 = [null, 'a', 33, 4];
var arr2 = [null, 'b', true];
var arr3 = foldArrays(arr1, arr2);
Expected arr3: [null, 'b', true, 4]
*/
foldArrays: function()
{
	var ret = [];

	for (var i = 0; i < arguments.length; i++)
	{
		var arr = arguments[i];
		if (!Array.isArray(arr))
			continue;
		while (ret.length < arr.length)
			ret.push(null);

		for (var j = 0; j < arr.length; j++)
		{
			if (ret[j] === null)
				ret[j] = arr[j];
			else if (arr[j] === null)
				ret[j] = ret[j];
			else
				ret[j] = arr[j];
		}
	}

	return ret;
},

// Splits a property string into an array based on separator
// while skipping separators within quotes and within parentheses.
splitProps: function (input, sep)
{
	var separator = sep || /\s/g,
		singleQuoteOpen = false,
		doubleQuoteOpen = false,
		openParens = 0;
		tokenBuffer = [],
		ret = [];

	var arr = input.split('');
	for (var i = 0; i < arr.length; ++i)
	{
		var element = arr[i],
			matches = element.match(separator);

		if (element === "'" && !doubleQuoteOpen)
		{
			tokenBuffer.push(element);
			singleQuoteOpen = !singleQuoteOpen;
			continue;
		}
		else if (element === '"' && !singleQuoteOpen)
		{
			tokenBuffer.push(element);
			doubleQuoteOpen = !doubleQuoteOpen;
			continue;
		}
		else if (element === '(')
		{
			openParens++;
			tokenBuffer.push(element);
			continue;
		}
		else if (element === ')')
		{
			openParens--;
			tokenBuffer.push(element);
			continue;
		}

		if (openParens > 0)
		{
			tokenBuffer.push(element);
			continue;
		}

		if (!singleQuoteOpen && !doubleQuoteOpen && matches)
		{
			if (tokenBuffer.length > 0)
			{
				ret.push(tokenBuffer.join(''));
				tokenBuffer = [];
			}
			else if (!!sep)
			{
				ret.push(element);
			}
		}
		else
		{
			tokenBuffer.push(element);
		}
	}
	if (tokenBuffer.length > 0)
	{
		ret.push(tokenBuffer.join(''));
	}
	else if (!!sep)
	{
		ret.push('');
	}

	return ret;
},

// Converts a named color into its hex equivalent.
// if the color doesn't exist, it returns input.
namedColorToHex: function(name)
{
	var colors = {'aliceblue':'#f0f8ff','antiquewhite':'#faebd7','aqua':'#00ffff',
		'aquamarine':'#7fffd4','azure':'#f0ffff','beige':'#f5f5dc','bisque':'#ffe4c4',
		'black':'#000000','blanchedalmond':'#ffebcd','blue':'#0000ff','blueviolet':'#8a2be2',
		'brown':'#a52a2a','burlywood':'#deb887','cadetblue':'#5f9ea0','chartreuse':'#7fff00',
		'chocolate':'#d2691e','coral':'#ff7f50','cornflowerblue':'#6495ed','cornsilk':'#fff8dc',
		'crimson':'#dc143c','cyan':'#00ffff','darkblue':'#00008b','darkcyan':'#008b8b',
		'darkgoldenrod':'#b8860b','darkgray':'#a9a9a9','darkgrey':'#a9a9a9','darkgreen':'#006400',
		'darkkhaki':'#bdb76b','darkmagenta':'#8b008b','darkolivegreen':'#556b2f','darkorange':'#ff8c00',
		'darkorchid':'#9932cc','darkred':'#8b0000','darksalmon':'#e9967a','darkseagreen':'#8fbc8f',
		'darkslateblue':'#483d8b','darkslategray':'#2f4f4f','darkslategrey':'#2f4f4f','darkturquoise':'#00ced1',
		'darkviolet':'#9400d3','deeppink':'#ff1493','deepskyblue':'#00bfff','dimgray':'#696969',
		'dimgrey':'#696969','dodgerblue':'#1e90ff','firebrick':'#b22222','floralwhite':'#fffaf0',
		'forestgreen':'#228b22','fuchsia':'#ff00ff','gainsboro':'#dcdcdc','ghostwhite':'#f8f8ff',
		'gold':'#ffd700','goldenrod':'#daa520','gray':'#808080','grey':'#808080','green':'#008000',
		'greenyellow':'#adff2f','honeydew':'#f0fff0','hotpink':'#ff69b4','indianred':'#cd5c5c',
		'indigo':'#4b0082','ivory':'#fffff0','khaki':'#f0e68c','lavender':'#e6e6fa','lavenderblush':'#fff0f5',
		'lawngreen':'#7cfc00','lemonchiffon':'#fffacd','lightblue':'#add8e6','lightcoral':'#f08080',
		'lightcyan':'#e0ffff','lightgoldenrodyellow':'#fafad2','lightgray':'#d3d3d3','lightgrey':'#d3d3d3',
		'lightgreen':'#90ee90','lightpink':'#ffb6c1','lightsalmon':'#ffa07a','lightseagreen':'#20b2aa',
		'lightskyblue':'#87cefa','lightslategray':'#778899','lightslategrey':'#778899','lightsteelblue':'#b0c4de',
		'lightyellow':'#ffffe0','lime':'#00ff00','limegreen':'#32cd32','linen':'#faf0e6','magenta':'#ff00ff',
		'maroon':'#800000','mediumaquamarine':'#66cdaa','mediumblue':'#0000cd','mediumorchid':'#ba55d3',
		'mediumpurple':'#9370d8','mediumseagreen':'#3cb371','mediumslateblue':'#7b68ee','mediumspringgreen':'#00fa9a',
		'mediumturquoise':'#48d1cc','mediumvioletred':'#c71585','midnightblue':'#191970','mintcream':'#f5fffa',
		'mistyrose':'#ffe4e1','moccasin':'#ffe4b5','navajowhite':'#ffdead','navy':'#000080','oldlace':'#fdf5e6',
		'olive':'#808000','olivedrab':'#6b8e23','orange':'#ffa500','orangered':'#ff4500','orchid':'#da70d6',
		'palegoldenrod':'#eee8aa','palegreen':'#98fb98','paleturquoise':'#afeeee','palevioletred':'#d87093',
		'papayawhip':'#ffefd5','peachpuff':'#ffdab9','peru':'#cd853f','pink':'#ffc0cb','plum':'#dda0dd',
		'powderblue':'#b0e0e6','purple':'#800080','red':'#ff0000','rosybrown':'#bc8f8f','royalblue':'#4169e1',
		'saddlebrown':'#8b4513','salmon':'#fa8072','sandybrown':'#f4a460','seagreen':'#2e8b57','seashell':'#fff5ee',
		'sienna':'#a0522d','silver':'#c0c0c0','skyblue':'#87ceeb','slateblue':'#6a5acd','slategray':'#708090',
		'slategrey':'#708090','snow':'#fffafa','springgreen':'#00ff7f','steelblue':'#4682b4','tan':'#d2b48c',
		'teal':'#008080','thistle':'#d8bfd8','tomato':'#ff6347','turquoise':'#40e0d0','violet':'#ee82ee',
		'wheat':'#f5deb3','white':'#ffffff','whitesmoke':'#f5f5f5','yellow':'#ffff00','yellowgreen':'#9acd32'};

	name = name.toLowerCase();

	if (!colors[name])
		return name;

	return colors[name];
},

// Converts an rgb color string like rbg(100, 50, 25) into its hex equivalent.
rgbStrToHex: function(str)
{
	var self = this,
		begin = str.indexOf('(') + 1,
		end = str.indexOf(')'),
		vals = str.substring(begin, end).split(','),
		r = parseInt(vals[0]),
		g = parseInt(vals[1]),
		b = parseInt(vals[2]);

	r = self.paddedHex(r);
	g = (g !== undefined) ? self.paddedHex(g) : r;
	b = (b !== undefined) ? self.paddedHex(b) : r;

	return '#' + r + g + b;
},

// Helper for rgbStrToHex.
paddedHex: function(n)
{
	var hex = (n < 10) ? '0' : '';
	hex += n.toString(16);
	return (hex.length === 1) ? '0' + hex : hex;
},

// This slows down an event so it only fires after a delay.
debounce: function(func, wait, immediate)
{
	var timeout;
	return function() {
		var context = this;
		var args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate)
				func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow)
			func.apply(context, args);
	};
},


//================
// Public methods.
//================

// Acts as a constructor to initialize object.
create: function()
{
	App.init();
},

}; // End var App.


//==================
// Global functions.
//==================
