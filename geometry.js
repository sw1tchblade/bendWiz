const d = document;
const wl = window.location;
const proc = d.getElementById("procsel");
const goBtn = d.getElementById("goBtn");
const backBtn = d.getElementById("backBtn");
const infoText = d.getElementById("infoText");

const MIN_PROC = 1;
const MAX_PROC = 318;

function clampProc(v) {
	let n = parseInt(v, 10);
	if (Number.isNaN(n)) n = MIN_PROC;
	return Math.max(MIN_PROC, Math.min(MAX_PROC, n));
}

function getProcFromURL() {
	const params = new URLSearchParams(wl.search);
	return clampProc(params.get("prc") || MIN_PROC);
}

function goToProcess(p) {
	const n = clampProc(p);
	wl.href = `geometry.html?prc=${n}`;
}

proc.value = getProcFromURL();

goBtn.addEventListener("click", () => goToProcess(proc.value));

proc.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		e.preventDefault();
		goToProcess(proc.value);
	}
});

backBtn.addEventListener("click", () => {
	const n = clampProc(proc.value);
	wl.href = `index.html?prc=${n}`;
});

function loadScript(url, onload, onerror) {
	const script = d.createElement("script");
	script.type = "text/javascript";
	script.src = url;
	script.onload = onload;
	script.onerror = onerror || function () {
		alert(`Failed to load ${url}`);
	};
	d.head.appendChild(script);
}

function toNumericArray(arr) {
	if (!Array.isArray(arr)) return [];
	return arr.map((x) => {
		const v = Number(x);
		return Number.isFinite(v) ? v : NaN;
	});
}

function legendHTML() {
	return `
		<div class="plot-legend-row">
			<span class="plot-legend-swatch" style="background:red"></span>
			<span>Secondary-axis [mm]</span>
		</div>
		<div class="plot-legend-row">
			<span class="plot-legend-swatch" style="background:blue"></span>
			<span>Main-axis [mm]</span>
		</div>
		<div class="plot-legend-row">
			<span class="plot-legend-swatch" style="background:green"></span>
			<span>Out-of-roundness [-]</span>
		</div>
		<div class="plot-legend-row">
			<span class="plot-legend-swatch" style="background:purple"></span>
			<span>Collapse [mm]</span>
		</div>
	`;
}

function tooltipHTML(payload, idx) {
	const x = payload.x[idx];
	const s = payload.secondary_axis[idx];
	const m = payload.main_axis[idx];
	const o = payload.out_of_roundness[idx];
	const c = payload.collapse[idx];

	return `
		<div class="plot-tooltip-title">
			${payload.section_name}<br>
			X: ${Number.isFinite(x) ? x.toFixed(4) : "NaN"}
		</div>
		<div class="plot-tooltip-row"><span class="plot-legend-swatch" style="background:red"></span><span>Secondary-axis: ${Number.isFinite(s) ? s.toFixed(4) : "NaN"} mm</span></div>
		<div class="plot-tooltip-row"><span class="plot-legend-swatch" style="background:blue"></span><span>Main-axis: ${Number.isFinite(m) ? m.toFixed(4) : "NaN"} mm</span></div>
		<div class="plot-tooltip-row"><span class="plot-legend-swatch" style="background:green"></span><span>Out-of-roundness: ${Number.isFinite(o) ? o.toFixed(6) : "NaN"}</span></div>
		<div class="plot-tooltip-row"><span class="plot-legend-swatch" style="background:purple"></span><span>Collapse: ${Number.isFinite(c) ? c.toFixed(4) : "NaN"} mm</span></div>
	`;
}

function xAxisLabel(sectionName) {
	if (sectionName.toLowerCase().includes("arc")) return "Angle [degree]";
	return "Distance [mm]";
}

function createPanel(payload, plotsRoot) {
	const panel = d.createElement("div");
	panel.className = "plot-panel";

	const title = d.createElement("div");
	title.className = "plot-title";
	title.textContent = payload.section_name;
	panel.appendChild(title);

	const legend = d.createElement("div");
	legend.className = "plot-legend";
	legend.innerHTML = legendHTML();
	panel.appendChild(legend);

	const tooltip = d.createElement("div");
	tooltip.className = "plot-tooltip";
	panel.appendChild(tooltip);

	const chartHolder = d.createElement("div");
	panel.appendChild(chartHolder);

	const x = toNumericArray(payload.x);
	const s = toNumericArray(payload.secondary_axis);
	const m = toNumericArray(payload.main_axis);
	const o = toNumericArray(payload.out_of_roundness);
	const c = toNumericArray(payload.collapse);

	const data = [x, s, m, o, c];

	const opts = {
		width: Math.max(900, window.innerWidth - 60),
		height: 280,
		legend: { show: false },
		series: [
			{ label: "x", show: false },
			{ label: "Secondary-axis [mm]", stroke: "red", width: 2 },
			{ label: "Main-axis [mm]", stroke: "blue", width: 2 },
			{ label: "Out-of-roundness [-]", stroke: "green", width: 2 },
			{ label: "Collapse [mm]", stroke: "purple", width: 2 },
		],
		axes: [
			{
				label: xAxisLabel(payload.section_name),
				grid: { show: true },
			},
			{
				label: "Raw value",
				side: 1,
				grid: { show: true },
			},
		],
		cursor: {
			drag: { x: true, y: false },
			focus: { prox: 16 },
		},
		hooks: {
			setCursor: [
				(u) => {
					const idx = u.cursor.idx;
					if (idx == null || idx < 0 || idx >= x.length) {
						tooltip.style.display = "none";
						return;
					}

					tooltip.innerHTML = tooltipHTML(payload, idx);
					tooltip.style.display = "block";

					const left = Math.min(
						u.cursor.left + 24,
						panel.clientWidth - tooltip.offsetWidth - 10
					);
					const top = Math.min(
						u.cursor.top + 18,
						panel.clientHeight - tooltip.offsetHeight - 10
					);

					tooltip.style.left = `${Math.max(10, left)}px`;
					tooltip.style.top = `${Math.max(35, top)}px`;
				},
			],
			ready: [
				(u) => {
					u.over.addEventListener("mouseleave", () => {
						tooltip.style.display = "none";
					});
				},
			],
		},
	};

	const plot = new uPlot(opts, data, chartHolder);

	window.addEventListener("resize", () => {
		plot.setSize({
			width: Math.max(900, window.innerWidth - 60),
			height: 280,
		});
	});

	plotsRoot.appendChild(panel);
}

function plotGeometry() {
	infoText.textContent = `Experiment: ${geo_experiment_id}\nGeometry view: raw key characteristics`;

	const root = d.createElement("div");
	root.id = "plotsRoot";

	if (window.geo_linear_1) createPanel(window.geo_linear_1, root);
	if (window.geo_arc) createPanel(window.geo_arc, root);
	if (window.geo_linear_2) createPanel(window.geo_linear_2, root);

	d.body.appendChild(root);
}

loadScript(`geo${proc.value}.js`, plotGeometry, function () {
	alert(`Could not load geometry file for process ${proc.value}`);
});