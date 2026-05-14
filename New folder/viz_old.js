d = document; // get elements & start by retrieving the subject:
wl = window.location;
proc = d.getElementById("procsel");
proc.value = wl.search.substr(5) == "" ? "1" : wl.search.substr(5);
proc.oninput = function (e) {
	wl.href = "index.html?prc=" + proc.value;
};

function loadScript(url, callback) {
	var script = d.createElement("script");
	script.type = "text/javascript";
	script.src = url;
	script.onreadystatechange = callback;
	script.onload = callback;
	d.head.appendChild(script);
}

var plotData = function () {
	const ids = [...Array(bendDieLatMov.length).keys()];
	const bendDieData = [ids, bendDieAng, bendDieLatMov];
	const colletData = [ids, colletAxForce, colletAxMov];
	const mandrelData = [ids, mandrelAxForce, mandrelAxMov];
	const pressData = [ids, pressAxForce, pressAxMov, pressLatForce];
	const wiperData = [ids, wiperAxForce, wiperLatForce, wiperLatMov];
	let uSync = uPlot.sync("both");
	// wheel scroll zoom
	const wheelZoomHk = [
		(u) => {
			let rect = u.over.getBoundingClientRect();
			u.over.addEventListener(
				"wheel",
				(e) => {
					let oxRange = u.scales.x.max - u.scales.x.min;
					let nxRange = e.deltaY < 0 ? oxRange * 0.95 : oxRange / 0.95;
					let nxMin =
						u.posToVal(u.cursor.left, "x") -
						(u.cursor.left / rect.width) * nxRange;
					if (nxMin < 0) nxMin = 0;
					let nxMax = nxMin + nxRange;
					if (nxMax > u.data[0][u.data[0].length - 1])
						nxMax = u.data[0][u.data[0].length - 1];
					u.batch(() => {
						uPlot.sync(u.cursor.sync.key).plots.forEach((p) => {
							p.setScale("x", { min: nxMin, max: nxMax });
						});
					});
				},
				{ passive: true },
			);
		},
	];

	const cursorOpts = {
		lock: true,
		sync: { key: "a" },
		y: false,
	};
	let opts = {
		width: window.innerWidth,
		height: window.innerHeight / 6,
		cursor: cursorOpts,
		axes: [{}, { scale: "readings", side: 1, grid: { show: true } }],
		scales: { auto: false, x: { time: false } },
		legend: { show: false },
	};

	const drawHkBendDie = [
		(u) => {
			u.ctx.fillStyle = "black";
			u.ctx.textAlign = "left";
			u.ctx.fillText("Bend Die", 2, 10);
			u.ctx.fillStyle = "red";
			u.ctx.fillText("Angle", 7, 40);
			u.ctx.fillStyle = "green";
			u.ctx.fillText("Movement", 7, 70);
		},
	];
	let bendDieOpts = {
		id: "bendDieChart",
		series: [
			{ fill: false, ticks: { show: false } },
			{ label: "bendDieAng", stroke: "red" },
			{ label: "bendDieLatMov", stroke: "green" },
		],
		hooks: { draw: drawHkBendDie, ready: wheelZoomHk },
	};
	bendDieOpts = Object.assign(opts, bendDieOpts);
	let bendDiePlot = new uPlot(bendDieOpts, bendDieData, document.body);

	const drawHkCollet = [
		(u) => {
			u.ctx.fillStyle = "black";
			u.ctx.textAlign = "left";
			u.ctx.fillText("Collet", 2, 10);
			u.ctx.fillStyle = "red";
			u.ctx.fillText("Axial force", 7, 40);
			u.ctx.fillStyle = "green";
			u.ctx.fillText("Axial movement", 7, 70);
		},
	];
	let colletOpts = {
		id: "colletChart",
		series: [
			{ fill: false, ticks: { show: false } },
			{ label: "colletAxForce", stroke: "red" },
			{ label: "colletAxMov", stroke: "green" },
		],
		hooks: { draw: drawHkCollet, ready: wheelZoomHk },
	};
	colletOpts = Object.assign(opts, colletOpts);
	let colletPlot = new uPlot(colletOpts, colletData, document.body);

	const drawHkMandrel = [
		(u) => {
			u.ctx.fillStyle = "black";
			u.ctx.textAlign = "left";
			u.ctx.fillText("Mandrel", 2, 10);
			u.ctx.fillStyle = "red";
			u.ctx.fillText("Axial force", 7, 40);
			u.ctx.fillStyle = "green";
			u.ctx.fillText("Axial movement", 7, 70);
		},
	];
	let mandrelOpts = {
		id: "mandrelChart",
		series: [
			{ fill: false, ticks: { show: false } },
			{ label: "mandrelAxForce", stroke: "red" },
			{ label: "mandrelAxMov", stroke: "green" },
		],
		hooks: { draw: drawHkMandrel, ready: wheelZoomHk },
	};
	mandrelOpts = Object.assign(opts, mandrelOpts);
	let mandrelPlot = new uPlot(mandrelOpts, mandrelData, document.body);

	const drawHkPress = [
		(u) => {
			u.ctx.fillStyle = "black";
			u.ctx.textAlign = "left";
			u.ctx.fillText("Pressure Die", 2, 10);
			u.ctx.fillStyle = "red";
			u.ctx.fillText("Axial force", 7, 40);
			u.ctx.fillStyle = "green";
			u.ctx.fillText("Axial movement", 7, 70);
			u.ctx.fillStyle = "blue";
			u.ctx.fillText("Lateral force", 7, 100);
		},
	];
	let pressOpts = {
		id: "pressChart",
		series: [
			{ fill: false, ticks: { show: false } },
			{ label: "pressAxForce", stroke: "red" },
			{ label: "pressAxMov", stroke: "green" },
			{ label: "pressLatForce", stroke: "blue" },
		],
		hooks: { draw: drawHkPress, ready: wheelZoomHk },
	};
	pressOpts = Object.assign(opts, pressOpts);
	let pressPlot = new uPlot(pressOpts, pressData, document.body);

	const drawHkWiper = [
		(u) => {
			u.ctx.fillStyle = "black";
			u.ctx.textAlign = "left";
			u.ctx.fillText("Wiper Die", 2, 10);
			u.ctx.fillStyle = "red";
			u.ctx.fillText("Axial force", 7, 40);
			u.ctx.fillStyle = "green";
			u.ctx.fillText("Lateral force", 7, 70);
			u.ctx.fillStyle = "blue";
			u.ctx.fillText("Lateral movement", 7, 100);
		},
	];
	let wiperOpts = {
		id: "wiperChart",
		series: [
			{ fill: false, ticks: { show: false } },
			{ label: "wiperAxForce", stroke: "red" },
			{ label: "wiperAxMov", stroke: "green" },
			{ label: "wiperLatForce", stroke: "blue" },
		],
		hooks: { draw: drawHkWiper, ready: wheelZoomHk },
	};
	wiperOpts = Object.assign(opts, wiperOpts);
	let wiperPlot = new uPlot(wiperOpts, wiperData, document.body);

	cursorOverride = d.getElementsByClassName("u-cursor-x");
	for (i of [0, 1, 2, 3, 4])
		cursorOverride[i].style = "border-right:3px solid #FF2D7D;";

	for (id of [
		"bendDieChart",
		"colletChart",
		"mandrelChart",
		"pressChart",
		"wiperChart",
	])
		d.getElementById(id).style.border = "solid";
	d.body.appendChild(
		d
			.createElement("p")
			.appendChild(
				d.createTextNode(
					"Scroll wheel zooms in and out, double-click resets the plot, click&drag zooms to a segment.",
				),
			),
	);

	// add info material:
	d.getElementById("infotext").innerHTML = info;

	// allow dynamic resizing:
	function getSize() {
		return { width: window.innerWidth, height: 320 };
	}
	window.addEventListener("resize", (e) => {
		bendDie_plot.setSize(getSize());
	});
};

loadScript("dta" + proc.value + ".js", plotData);
