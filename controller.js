//
// TotalSpaceCommander
// MClarkDev.com, 2022
// All rights reserved.
//

// Local Variables
var appRoot;
var ticks = 0;
var connfail = 0;
var connecting;
var disconnected;
var conf = new Array();
var request = {};
var inFlight = {};
var tones = {};
var lastSent = 0;
var wsKeepAlive = (30 * 1000);

// Default theme
var defaultColors = ["#808080", "#282828"];
var defaultFilter = [118, 82, 30];
var defaultStatusIcons = {
	"unknown": "base/alert1",
	"connecting": "base/cell1-0",
	"connected": "base/tools6",
	"disconnected": "base/alert4",
	"request": "base/network6"
};

//
// Initialization
//

// Called to being page initialization.
function init() {

	// Determine appRoot
	var path = window.location.pathname;
	var pidx = path.lastIndexOf('/');
	var appPath = appRoot = path.substring(0, pidx);
	appRoot = document.location.origin + appPath;

	// Setup device if tablet
	setupTablet();

	// Set last mute state
	setMute(getMute());

	// Setup window handler
	window.onhashchange = loadConfig;
	window.onresize = checkWindowSize;

	// Setup recurring function timers
	setInterval(keepAlive, wsKeepAlive);
	setInterval(tick, (1 / 10) * 1000);

	// Connect to WS
	connect();
}

// Check if tablet API available
function isTablet() {
	return (typeof fully !== 'undefined');
}

// Load tablet scripts if API available
function setupTablet() {
	if (!isTablet()) {
		return false;
	}

	log("Tablet interface detected, loading addon.");
	var script = document.createElement("script");
	script.src = (appRoot + "/tablet.js");
	document.head.appendChild(script);
}

// Called each tick.
// Runs loaded dashboard and button methods.
function tick(start = false) {

	// Do not tick if disconnected
	if (!connected()) {
		return;
	}

	// Do not tick if paused or not connected
	if ((ticks == 0 && !(start))) {
		return;
	}

	// Tick main config object
	if ('tick' in conf) {

		// Tick on 0 or multiple of interval
		if (((ticks % conf.interval) == 0) || (ticks == 0)) {
			conf.tick();
		}
	}

	// Tick each button object
	for (var f in conf.objects) {
		var o = conf.objects[f];
		if (!('tick' in o)) {
			continue;
		}

		// Skip if object not active
		if ('if' in o && !o.if) {
			continue;
		}

		// Tick on 0 or multiple of interval
		if (((ticks % o.interval) == 0) || (ticks == 0)) {

			var obj = getRawButton(o.pos[0], o.pos[1]);

			if (obj) {
				o.tick(obj);
			}
		}
	}

	ticks++;
}


//
// Dashboard Builder
//

// Load the dashboard config file.
function loadConfig() {

	// Get last visited page, or default
	if (!window.location.hash) {
		var last = window.localStorage.getItem("last");
		nav((last != null) ? last : "default");
		return;
	}

	// Pause ticking
	ticks = 0;

	// Get new page path, load config script
	var pageHash = window.location.hash;
	var pageParts = pageHash.substring(1).split(":");
	request['pageName'] = pageParts[0];
	request['pageArgs'] = (pageParts.length == 2) ? pageParts[1] : null;

	// Fetch dashboard config
	log("Requesting dashboard config.");
	call({
		"action": "script.get",
		"type": "DASHBOARD",
		"name": request['pageName']
	}, function(response) {
		switch (response.code) {
			case 404:
				dialog("Not Found", "The requested dashboard was not found.", function() {
					nav("default");
				});
				return;
			case 401:
				dialog("Not Authorized", response.message, function() {
					nav("login");
				});
				return;
			case 429:
				// No license
				return;
		}

		// Create script element
		log("Injecting dashboard script.");
		var script = document.createElement("script");
		var container = document.getElementById("dashboardScript");
		container.innerHTML = "";
		container.appendChild(script);

		// Decode and set script
		script.innerHTML = atob(response.script.script);

		// Load the dashboad
		loadController();
	});
}

// Load the dashboard from config.
function loadController() {
	log("Loading dashboard config.");

	// Get page name
	var page = window.location.hash.substring(1);
	window.localStorage.setItem("last", page);

	// Reset 
	inFlight = {};
	conf.meta = {};

	// Preload meta variables
	if ('vars' in conf) {
		getMetas(conf.vars);
	}

	// Check size and build grid
	checkWindowSize();

	// Set the taskbar name
	document.title = ('title' in conf) ? conf.title : "Total Space Commander";

	// Auto-reconnect
	document.reconnect = ('reconnect' in conf) ? conf.reconnect : true;

	// Load background image/color
	var wrapper = document.getElementById("wrapper");
	if (!('background' in conf)) {
		wrapper.style.backgroundImage = "";
		wrapper.style.backgroundColor = "";
	} else {
		if (conf.background.startsWith("#")) {
			wrapper.style.backgroundImage = "";
			wrapper.style.backgroundColor = conf.background;
		} else {
			wrapper.style.backgroundColor = "";
			wrapper.style.backgroundImage = 'url("' + (appRoot + "/img/bg/" + conf.background) + '.png")';
		}
	}

	// Use default icons if not defined
	if (!('statusIcons' in conf)) {
		conf.statusIcons = defaultStatusIcons;
	}

	// Preload all status icons
	for (var x in conf.statusIcons) {
		(new Image()).src = (appRoot + "/img/ico/" + conf.statusIcons[x] + '.png');
	}

	// Use default filter if not defined
	if (!('filter' in conf)) {
		conf.filter = defaultFilter;
	}

	// Use default colors if not defined
	if (!('colors' in conf)) {
		conf.colors = defaultColors;
	}

	loadDashboard();
}

function loadDashboard() {

	// 'init' function called first
	if ('init' in conf) {
		log("Dashboard init");
		conf.init();
	}

	// render the page
	renderDashboard();

	// Reset and tick
	ticks = 0;
	tick(true);
}

// Render the page grid and buttons.
function renderDashboard() {
	log("Rendering dashboard.");

	// Initialize the root grid
	buildObjectGrid();

	// Load all config objects
	log("Loading config objects.");
	for (var f in conf.objects) {
		try {
			setupButton(conf.objects[f]);
		} catch (e) {
			console.log("Failed to setup button.");
			console.log(conf.objects[f]);
			console.log(e);
		}
	}

	// 'setup' function called last
	if ('setup' in conf) {
		log("Dashboard setup");
		conf.setup(conf);
	}

	// send objects current state
	processEvent("systemState", document._state);
}

// Clear page and build the root object grid.
function buildObjectGrid() {
	log("Building object grid.");

	// Calculate count and size
	conf.colsP = 100 / conf.cols;
	conf.rowsP = 100 / conf.rows;

	// Get and reset grid
	var table = document.getElementById("objectGrid");
	table.innerHTML = "";

	// Loop rows
	for (var y = 0; y < conf.rows; y++) {
		var row = document.createElement("tr");
		setSize(row, null, (conf.rowsP + "%"));
		//row.style.lineHeight = conf.rowsP + "%";
		table.appendChild(row);

		// Loop columns
		for (var x = 0; x < conf.cols; x++) {
			var pos = x + "-" + y;
			var cell = document.createElement("td");
			cell.id = "btn-" + pos;
			cell.classList.add("button");
			cell.innerHTML = conf.debug ? pos : "";
			setSize(cell, (conf.colsP + "%"), (conf.rowsP + "%"));
			row.appendChild(cell);
		}
	}
}

// Setup a dashboard button.
function setupButton(btn) {
	log("Building button: " + JSON.stringify(btn));

	// Skip if not active
	if ('if' in btn && !btn.if) {
		return;
	}

	// Get button and make active
	var cell = getRawButton(btn.pos[0], btn.pos[1]);
	cell.innerHTML = "";
	cell.classList.add("active");

	// Set button size
	if ('size' in btn) {

		// Hide overlapped buttons
		for (var y = 1; y <= btn.size[1]; y++) {
			for (var x = 1; x <= btn.size[0]; x++) {

				var posX = btn.pos[0] + x - 1;
				var posY = btn.pos[1] + y - 1;
				var hide = "btn-" + posX + "-" + posY;

				if (hide == cell.id) {
					continue;
				}
				document.getElementById(hide).style.display = "none";
			}
		}

		// Override width
		if (btn.size[0] > 1) {
			cell.colSpan = btn.size[0];

			var width = (btn.size[0] * conf.colsP);
			cell.style.width = width + "%";
			cell.style.maxWidth = width + "%";
			cell.style.minWidth = width + "%";
		}

		// Override height
		if (btn.size[1] > 1) {
			cell.rowSpan = btn.size[1];

			var height = (btn.size[1] * conf.rowsP);
			cell.style.height = height + "%";
			cell.style.maxHeight = height + "%";
			cell.style.minHeight = height + "%";
		}
	}

	// Apply custom styles or default
	btn.colors = ('colors' in btn) ? btn.colors : conf.colors;
	cell.style.backgroundColor = btn.colors[1];
	cell.style.color = btn.colors[0];

	// Image if set
	if ('image' in btn) {
		cell.style.backgroundImage = 'url("' + (appRoot + "/img/bg/" + btn.image) + '.png")';
	}

	// Icon if set
	if ('icon' in btn) {

		var icon = document.createElement("img");
		icon.classList.add("filtered");
		icon.classList.add("icon");

		var filter = ('filter' in btn) ? btn.filter : conf.filter;
		var rotate = ('rotate' in btn) ? btn.rotate : 0;

		var icon = createIcon(btn.icon, filter, rotate);
		cell.appendChild(icon);

		//var img = setButtonIcon(cell, btn.icon, filter, rotate);

		if ('font' in btn) {
			icon.style.width = btn.font;
			icon.style.height = btn.font;
		}
	}

	// Navigate if set
	if ('navigate' in btn) {
		cell.onclick = function() {
			nav(btn.navigate);
		};
	}

	// Command if set
	if ('command' in btn) {
		cell.onclick = function() {
			doAction(btn);
		};
	} else// Or
		// Handler if set
		if ('handler' in btn) {
			cell.onclick = function() {
				doHandler(btn);
			};
		}

	// Text if set
	if ('text' in btn) {

		var inner = document.createElement("div");
		setButtonTextRaw(inner, btn.text);
		cell.appendChild(inner);

		if ('font' in btn) {
			inner.style.fontSize = btn.font;
		}

		if ('bold' in btn && btn.bold) {
			inner.style.fontWeight = "bold";
		}

		if ('setup' in btn) {
			btn.setup(inner, btn);
		}

	} else {

		if ('setup' in btn) {
			btn.setup(cell, btn);
		}
	}

	// Return the created cell
	return cell;
}

function createIcon(image, filter, rotate) {
	var icon = document.createElement("img");
	icon.classList.add("filtered");
	icon.classList.add("icon");

	// set image
	if (image != null) {
		icon.src = (appRoot + "/img/ico/" + image + ".png");
	}

	// set filter
	if (filter != null) {
		icon.style.filter = getFilterString(filter);
	}

	//set rotate
	if (rotate != null) {
		icon.style.transform = "rotate(" + (rotate + "deg") + ")";
	}

	return icon;
}

// Update a button to show the current connection status
function updateStatusIcon(btn) {

	var ws = document.ws.readyState;
	var img = conf.statusIcons['unknown'];

	switch (ws) {
		case 0:
			img = conf.statusIcons['connecting'];
			break;

		case 1:
			img = conf.statusIcons['connected'];
			break;

		case 2:
		case 3:
			img = conf.statusIcons['disconnected'];
			break;
	}

	if (ws && (Object.keys(inFlight).length > 0)) {
		img = conf.statusIcons['request'];
	}

	setButtonIcon(btn, img);
}

// Set the text of a button
function setButtonText(cell, text) {

	var obj = cell.childNodes[0];
	setButtonTextRaw(obj, text);
}

// Set the text of a button
function setButtonTextRaw(obj, text) {

	if (text.includes("\\n")) {
		obj.style.lineHeight = "100%";
		obj.innerHTML = text.replaceAll("\\n", "<br/>");
	} else {
		obj.innerHTML = text;
	}
}

// setIconImage -> setButtonIcon
function setButtonIcon(cell, icon, filter, rotate) {

	var obj = cell.childNodes[0];
	return setButtonIconRaw(obj, icon, filter, rotate);
}

// setIconImageRaw -> setButtonIconRaw
function setButtonIconRaw(img, icon, filter, rotate) {

	var imgNew = (appRoot + "/img/ico/" + icon + ".png");

	if (img.src != imgNew) {
		log("Updating icon: " + img.src + " -> " + imgNew);

		img.src = imgNew;
	}

	// set filter
	if (filter != null) {
		img.style.filter = getFilterString(filter);
	}

	if (rotate != null) {
		img.style.transform = "rotate(" + (rotate + "deg") + ")";
	}

	return img;
}

// Build a hue-filter string
function getFilterString(args) {
	return ("hue-rotate(" + args[0] + "deg) " + //
		"brightness(" + args[1] + "%) " + //
		"saturate(" + args[2] + "%)");
}

// Get a button by it's position
function getRawButton(x, y) {
	var id = "btn-" + x + "-" + y;
	return document.getElementById(id);
}

// Get a button by it's position
function getButton(x, y) {
	var b = getRawButton(x, y);
	return (b == null) ? null : b.childNodes[0];
}

// Get a button by it's "name" attribute
function getButtonByName(name) {

	// loop each button
	for (var f in conf.objects) {
		var o = conf.objects[f];
		if (!('name' in o)) {
			continue;
		}

		if (o.name == name) {
			return getRawButton(o.pos[0], o.pos[1]);
		}
	}
}

// Check and set proper display mode (portrait / landscape)
function checkWindowSize() {

	if ((window.innerWidth > window.innerHeight) && ('landscape' in conf)) {
		nav(conf.landscape);
		return;
	}

	if ((window.innerHeight > window.innerWidth) && ('portrait' in conf)) {
		nav(conf.portrait);
		return;
	}

	if (('resize' in conf) && (ticks > 0)) {
		conf.resize();
	}
}

// Make a button a list
function setupList(btn, list, selected, render, click, scroll) {

	var wHeight = document.getElementById("objectGrid").offsetHeight;
	var nRows = conf.rows;
	var iHeight = Math.floor(((1 / nRows) / 2) * wHeight);
	var nItems = btn.rowSpan * 2;

	var half = (.5 * nItems);

	var start = (selected > half) ? (selected - half) : 0;
	var end = (nItems + start);
	start -= (end > list.length) ? (end - list.length) : 0;

	var ol = document.createElement("ul");
	for (let i = start; i < end; i++) {
		if (!(i in list)) {
			continue;
		}

		var m = document.createElement("li");
		//m.style.inlineSize = (conf.colsP + "%");


		var response = (render != null) ? render(list, i) : list[i];
		if (response && response.charAt) {
			m.innerHTML = response;
		} else {
			m.appendChild(response);
		}

		m.style.height = iHeight + "px";
		m.style.lineHeight = iHeight + "px";

		if (selected == i) {
			m.classList.add("selected");
		}

		if (click) {
			m.onclick = function(e) {
				click(i, e);
			};
		}

		ol.appendChild(m);
	}

	btn.innerHTML = "";
	btn.appendChild(ol);
	btn.onwheel = (scroll) ? scroll : null;
}

// Set an object size
function setSize(obj, w, h) {

	obj.style.width = w;
	obj.style.maxWidth = w;
	obj.style.minWidth = w;
	obj.style.height = h;
	obj.style.maxHeight = h;
	obj.style.minHeight = h;
}

// Flatten an object
function flatten(obj, prefix = "") {
	var out = { keys: [], vals: [], };

	for (var i in obj) {

		if ((typeof obj[i] == 'number') ||
			(typeof obj[i] == 'string')) {

			out.keys.push(prefix + "." + i);
			out.vals.push(obj[i]);

		} else if (obj[i] instanceof Object) {

			var f = flatten(obj[i], (prefix + "." + i));
			out.keys = out.keys.concat(f.keys);
			out.vals = out.vals.concat(f.vals);
		}
	}

	return out;
}

// Save a file
function saveAs(name, data) {

	log("Exporting data...");

	let element = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8,'
		+ encodeURIComponent(data));
	element.setAttribute('download', name);

	element.style.display = 'none';
	document.body.appendChild(element);

	element.click();

	document.body.removeChild(element);
}


//
// Button Handlers
//

// Custom Handler
function doHandler(btn) {

	var obj = getRawButton(btn.pos[0], btn.pos[1]);

	obj.style.backgroundColor = "#992828";
	obj.style.pointerEvents = "none";
	obj.style.opacity = "0.5";

	try {

		btn.handler(obj);

		if ('tone' in btn) {
			play(btn.tone);
		}

	} catch (e) {
		console.log(e);
		notify("Failed");
		play('error');
		return;

	} finally {

		obj.style.backgroundColor = btn.colors[1];
		obj.style.pointerEvents = "all";
		obj.style.opacity = "1.0";
	}
}

// Command Handler
function doAction(btn) {

	var obj = getRawButton(btn.pos[0], btn.pos[1]);
	obj.style.backgroundColor = "#992828";
	obj.style.pointerEvents = "none";
	obj.style.opacity = "0.5";

	call(btn.command, function(data) {

		obj.style.backgroundColor = btn.colors[1];
		obj.style.pointerEvents = "all";
		obj.style.opacity = "1.0";

		if (data.code != 200) {
			var msg = "";
			switch (data.code) {
				case 400:
					msg = "Request error.";
					break;

				case 429:
					msg = "Client license is not active.";
					break;

				case 404:
					msg = "Command not found.";
					break;

				case 500:
					msg = "Server error.";
					break;

				default:
					msg = "Unknown error.";
					break;

			}

			if (data.message) {
				msg += "<br/> - " + data.message;
			}

			notify(msg, "Failed");
			play('error');
			return;
		}

		if ('callback' in btn) {
			btn.callback(data);
		}

		if ('tone' in btn) {
			play(btn.tone);
		}
	});
}


//
// Navigation
//

// Reload the whole page.
function reload() {
	window.location.reload();
}

// Load new dashboard or external page.
function nav(page = "default", tab = false) {
	log("Navigating to: " + page);

	if (tab) {
		window.open(page, "_blank");
	} else {
		if (page.startsWith("http") || page.startsWith("/")) {
			window.location.href = page;
		} else {
			window.location.hash = page;
		}
	}
}


//
// Notifications
//

// Clear all notifications currently displayed.
function clearAllNotify() {
	document.getElementById("notificationList").innerHTML = "";
}

// Clear a given notification.
function clearNotify(obj) {
	if (obj == null) {
		return;
	}

	var list = document.getElementById("notificationList");
	if (obj.parentElement == list) {
		list.removeChild(obj);
	}
}

// Display a notification badge.
function notify(msg, title = null, delay = 8000, closable = true, handler = null) {
	log("Notification: " + title + " :: " + msg);

	var body = "";
	if (title != null) {
		body += "<b>" + title + "</b><br/>";
	}
	body += msg;

	var notif = document.createElement("div");
	notif.classList.add("notification");
	notif.onClick = handler;

	if (closable) {
		var close = document.createElement("img");
		close.classList.add("notificationX");
		setButtonIconRaw(close, "base/alarm0", [230, 100, 90]);
		close.onclick = function() {
			clearNotify(notif);
		}

		notif.appendChild(close);
	}

	var text = document.createElement("span");
	text.classList.add("notificationT");
	text.innerHTML = body;
	notif.appendChild(text);

	document.getElementById("notificationList").appendChild(notif);

	setTimeout(function() {
		clearNotify(notif);
	}, delay);

	return notif;
}

// Clear the visible dialog.
function clearDialog(obj) {
	if (obj == null) {
		return false;
	}

	var wrap = document.getElementById("wrapper");
	if (obj.parentElement == wrap) {
		wrap.removeChild(obj);
	}
}

// Show a dialog and prompt for basic user input.
function dialog(title, msg, handler = null, options = ['Okay']) {
	log("Dialog: " + title + " :: " + options);

	var overlay = document.createElement("div");
	overlay.classList.add("overlay");

	var prompt = document.createElement("div");
	prompt.classList.add("prompt");
	overlay.appendChild(prompt);

	var header = document.createElement("div");
	header.classList.add("prompt-header");
	prompt.appendChild(header);
	header.innerHTML = title;

	var body = document.createElement("div");
	body.classList.add("prompt-body");
	prompt.appendChild(body);

	var message = document.createElement("span");
	message.innerHTML = msg;
	body.appendChild(message);

	var inputs = document.createElement("table");
	inputs.classList.add("prompt-inputs");
	prompt.appendChild(inputs);

	var inputsRow = document.createElement("tr");
	inputs.appendChild(inputsRow);

	var pct = 100 / options.length;
	for (var i in options) {

		var option = options[i];
		var input = document.createElement("td");
		input.classList.add("prompt-input");
		input.style.width = pct + "%";
		input.innerHTML = option;
		inputsRow.appendChild(input);
		input.onclick = function(caller) {
			document.getElementById("wrapper").removeChild(overlay);
			handler = (handler != null) ? handler : function() {
				clearDialog(overlay);
			};
			handler(caller.target.innerHTML);
		}
	}

	document.getElementById("wrapper").appendChild(overlay);

	return overlay;
}

function updateDialog(obj, msg) {
	obj.getElementsByTagName("span")[0].innerHTML = msg;
}

// Log a debug message.
function log(msg) {
	if (conf.debug) console.log(msg);
}


//
// Audio
//

// Play a tone.
function play(tone) {
	if (document.mute) {
		return;
	}

	if (!tones[tone]) {
		log("Loading tone: " + tone);
		tones[tone] = new Audio(appRoot + "/tones/" + tone + ".mp3");
	}

	log("Playing tone: " + tone);
	tones[tone].play();
}

// Check if should be muted.
function getMute() {
	document.mute = window.localStorage.getItem("mute") == "mute";
	return document.mute;
}

// Set requested mute state.
function setMute(mute = true) {
	document.mute = mute;
	var prop = mute ? "mute" : "unmute";
	window.localStorage.setItem("mute", prop);
	log("Set local mute: " + prop);
}


//
// Connection Manager
//

// Disconnect from the websocket.
function disconnect() {

	if (connected()) {

		log("Disconnecting from Websocket.");
		document.reconnect = false;
		document.ws.close();
	}
}

// Check if connected to the websocket.
function connected() {
	return (document.ws && document.ws.readyState == 1);
}

// Establish a connection to the websocket.
function connect() {

	// skip if connected
	if (connected()) {
		return;
	}

	var timeout = (connfail * 750);
	setTimeout(function() {
		if (!connected()) {
			clearDialog(disconnected);
			disconnected = dialog("Connecting", "Please wait, connecting...<br/>" + (timeout), null, ["Okay"]);
		}
	}, 1000);

	log("Connecting...");
	document.ws = new WebSocket("ws://" + window.location.host + "/socket/");
	document.ws.onmessage = wsMessage;
	document.ws.onerror = function() {
		connfail++;
	};
	document.ws.onclose = function() {
		log("Websocket closed.");
		connfail++;

		if (document.reconnect) {
			connecting = setTimeout(connect, timeout);
		} else {
			clearDialog(disconnected);
			disconnected = dialog("Disconnected", "Click to reconnect.", connect, ["Reconnect"]);
		}
	};
	document.ws.onopen = function() {
		log("Websocket opened.");
		connfail = 0;

		clearTimeout(connecting);
		clearDialog(disconnected);
	}
}

// Evaluate a websocket message.
function wsMessage(e) {

	// parse response as json
	var response = JSON.parse(e.data);

	// process as in-flight response
	if (('_uid' in response) && (response._uid in inFlight)) {
		if (inFlight[response._uid] != null) {
			inFlight[response._uid].callback(response);
		}
		delete inFlight[response._uid];
		return;
	}

	// process as remote action
	if ('do' in response) {
		actionRequest(response);
		return;
	}
}

function actionRequest(response) {

	switch (response.do) {

		case "connect":
			initClient(response.auth);
			break;

		case "navigate":
			nav(response.page);
			break;

		case "reload":
			reload();
			break;

case "notify":
notify(response.message, response.title);
break;

		case "event":
			processEvent(response.event, response.value);
			break;
	}
}

// Process a server event
function processEvent(event, value) {

	if (event == "systemState") {
		document._state = value;
	}

	// process event for each button
	for (var f in conf.objects) {
		var o = conf.objects[f];
		if (!(event in o)) {
			continue;
		}

		// call the implemented method		
		o[event](getRawButton(o.pos[0], o.pos[1]), value);
	}
}

// Submit the a request and await a response via callback.
function call(req, callback) {

	if (!connected()) {
		notify("Could not send command.\\nNot connected to endpoint.", "Connection Error", connect);
	}

	// Create a copy of the request
	req = Object.assign({}, req);
	req._sid = document.session;
	req._uid = Math.random().toString(16).substring(2, 10);

	// Send request and save callback
	var payload = JSON.stringify(req);
	log("Request --> " + payload);
	inFlight[req._uid] = {
		"request": req,
		"callback": function(data) {
			log("Response <- " + JSON.stringify(data));
			if (callback) {
				callback(data);
			}
		}
	};
	document.ws.send(payload);
	lastSent = Date.now();
}

// Send a keepalive packet.
function keepAlive() {
	if ((lastSent + wsKeepAlive) > Date.now()) {
		return;
	}

	log("Sending keep-alive ping.");
	call({ "action": "ping" });
}


//
// Server Handlers
//

// Load the client license.
function initClient(auth) {

	document._state = auth.state;
	document._license = auth.license;
	document._session = auth.session;

	log("Loading license info.");
	var warning = document.getElementById("warning");
	if (!warning && auth.license.licenseTrial) {
		warning = document.createElement("img");
		warning.id = "warning";
		warning.src = (appRoot + '/img/sys/unlicensed.png');
		document.getElementById("wrapper").appendChild(warning);
	} else if (warning) {
		warning.remove();
	}

	if (!auth.license.licenseValid) {
		dialog("Check License", "This terminal is not licensed.", function(r) {
			switch (r) {
				case "Reconnect":
					reload();
					break;
				case "Okay":
					nav("/");
					break;
			}

		}, ["Reconnect", "Okay"]);
	};

	loadConfig();
}


//
// Meta Helpers
//

// Get meta value for given key.
function getMeta(key, callback = null) {
	if (('meta' in conf) && (key in conf.meta)) {
		if (callback) {
			callback(conf.meta[key]);
		}
		return;
	}

	call({
		"action": "meta.get",
		"keys": [key]
	}, function(data) {
		if (!('values' in data)) {
			return;
		}

		if (!(key in data.values)) {
			if (callback) {
				callback(null);
			}
			return;
		}

		conf.meta[key] = data.values[key];

		if (callback) {
			callback(data.values[key]);
		}
	});
}

// Get meta values for the given array of keys.
function getMetas(keys) {
	call({
		"action": "meta.get",
		"keys": keys
	}, function(data) {
		if ('values' in data) {
			for (var key in data.values) {
				conf.meta[key] = data.values[key];
			}
		}
	});
}

// Set a meta key/value pair.
function setMeta(key, value, secure = false) {
	if (!secure) {
		conf.meta[key] = value;
	} else if (key in conf.meta) {
		delete conf.meta[key];
	}

	call({ "action": "meta.set", "key": key, "value": value, "secure": secure });
}

// Remove a given meta entry by key.
function delMeta(key) {
	if (key in conf.meta) {
		delete conf.meta.key;
	}

	call({
		"action": "meta.delete",
		"key": key
	});
}

// Reload meta cache.
function reloadMeta() {
	call({ "action": "meta.reload" });
}


//
// User Functions
//

// Invoke single command, print response to console.
function cmd(req) {
	call(req, function(data) {
		var j = JSON.stringify(data, null, 4);
		console.log(j);
	});
}

// Time the response for a simple command.
function ping(callback = null) {
	var tS = Date.now();
	call({
		"action": "ping"
	}, function() {
		var tR = Date.now();

		var tD = tR - tS;
		if (callback) {
			callback(tD);
		} else {
			console.log(tD + "ms");
		}
	});
}

// Run a given automation script.
function runScript(script, callback) {
	call({
		"action": "automation.run",
		"name": script
	}, function() {
		if (callback) {
			callback();
		}
	});
}

// Broadcast an event to all connected clients.
function broadcast(event, value) {
	call({
		"action": "broadcast",
		"payload": {
			"do": "event",
			"event": event,
			"value": value
		}
	});
}
