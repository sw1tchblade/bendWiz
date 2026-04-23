const d = document;
const wl = window.location;
const proc = d.getElementById("procsel");
const vid = d.getElementById("v0");

const MIN_PROC = 1;
const MAX_PROC = 318;

let GLOBAL_ACTUAL_TIME = [];
let GLOBAL_DISPLAY_TIME = [];
let ALL_PLOTS = [];
let VIDEO_ENABLED = false;

function clampProc(v) {
	let n = parseInt(v, 10);
	if (Number.isNaN(n)) n = MIN_PROC;
	return Math.max(MIN_PROC, Math.min(MAX_PROC, n));
}

function getProcFromURL() {
	const params = new URLSearchParams(wl.search);

    const prc = params.get("prc");
    
    // If 'prc' exists in URL, use it; otherwise, default to 79
    return clampProc(prc !== null ? prc : 79);
}

function goToProcess(p) {
	const n = clampProc(p);
	
	// Define custom messages for failed experiments
    const failures = {
        1: "Connection to the machine failed.",
        48: "Connection to the machine failed.",
        166: "Collision during program start."
    };

    // If the ID is in our failure list, alert the user and stop the reload
    if (failures[n]) {
        alert(`ID ${n}: ${failures[n]}`);
        return; // This stops the page from redirecting/reloading
    }

    // Otherwise, proceed as normal
	wl.href = `index.html?prc=${n}`;
}

proc.value = getProcFromURL();

proc.addEventListener("change", () => {
	goToProcess(proc.value);
});

proc.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		e.preventDefault();
		goToProcess(proc.value);
	}
});

function loadScript(url, onload, onerror) {
	const script = d.createElement("script");
	script.type = "text/javascript";
	script.src = url;
	script.onload = onload;
	script.onerror =
		onerror ||
		function () {
			alert(`Failed to load ${url}`);
		};
	d.head.appendChild(script);
}

function injectStyles() {
	const old = d.getElementById("custom-plot-styles");
	if (old) old.remove();

	const style = d.createElement("style");
	style.id = "custom-plot-styles";
	style.textContent = `
		#plotsRoot {
			display: grid;
			grid-template-columns: 1fr;
			gap: 16px;
			margin-top: 12px;
		}
		.plot-panel {
			position: relative;
			border: 1px solid #999;
			border-radius: 6px;
			padding: 10px 10px 4px 10px;
			background: #fff;
			box-sizing: border-box;
		}
		.plot-title {
			font-size: 16px;
			font-weight: 600;
			margin: 0 0 8px 0;
		}
		.plot-legend {
			position: absolute;
			top: 10px;
			right: 10px;
			background: rgba(255,255,255,0.95);
			border: 1px solid #bbb;
			border-radius: 6px;
			padding: 8px 10px;
			font-size: 12px;
			line-height: 1.35;
			box-shadow: 0 2px 8px rgba(0,0,0,0.08);
			max-width: 320px;
			z-index: 20;
		}
		.plot-legend-title {
			font-weight: 700;
			margin-bottom: 4px;
		}
		.plot-legend-row {
			display: flex;
			align-items: center;
			gap: 8px;
			margin: 2px 0;
			white-space: nowrap;
		}
		.plot-legend-swatch {
			width: 10px;
			height: 10px;
			border-radius: 2px;
			display: inline-block;
			flex: 0 0 10px;
		}
		.plot-tooltip {
			position: absolute;
			display: none;
			pointer-events: none;
			background: rgba(255,255,255,0.97);
			border: 1px solid #666;
			border-radius: 6px;
			padding: 8px 10px;
			font-size: 12px;
			line-height: 1.35;
			box-shadow: 0 4px 12px rgba(0,0,0,0.15);
			max-width: 420px;
			z-index: 30;
			white-space: nowrap;
		}
		.plot-tooltip-title {
			font-weight: 700;
			margin-bottom: 4px;
		}
		.plot-tooltip-row {
			display: flex;
			align-items: center;
			gap: 8px;
			margin: 2px 0;
		}
		.note-block {
			margin: 10px 0 14px 0;
			font-size: 13px;
		}
		.uplot {
			margin-top: 6px;
		}
	`;
	d.head.appendChild(style);
}

function numericArray(arr) {
	if (!Array.isArray(arr)) return [];
	return arr.map((x) => {
		const v = Number(x);
		return Number.isFinite(v) ? v : NaN;
	});
}

function normalizeSeries(arr) {
	const vals = numericArray(arr);
	const finiteVals = vals.filter(Number.isFinite);

	if (finiteVals.length === 0) {
		return vals.map(() => 0.5);
	}

	const min = Math.min(...finiteVals);
	const max = Math.max(...finiteVals);

	if (max === min) {
		return vals.map(() => 0.5);
	}

	return vals.map((v) => {
		if (!Number.isFinite(v)) return 0.5;
		return (v - min) / (max - min);
	});
}

function normalizeTimeAxis(arr, start = 0, end = 1000) {
	const vals = numericArray(arr);
	const finiteVals = vals.filter(Number.isFinite);

	if (finiteVals.length === 0) return vals.map(() => start);

	const min = Math.min(...finiteVals);
	const max = Math.max(...finiteVals);

	if (max === min) {
		return vals.map(() => (start + end) / 2);
	}

	return vals.map((v) => {
		if (!Number.isFinite(v)) return start;
		return start + ((v - min) / (max - min)) * (end - start);
	});
}

function getTimeAxis() {
	if (Array.isArray(window.time) && window.time.length > 0) {
		return numericArray(window.time);
	}
	if (Array.isArray(window.ids) && window.ids.length > 0) {
		return numericArray(window.ids);
	}
	if (Array.isArray(window.bendDieLatT_raw) && window.bendDieLatT_raw.length > 0) {
		return [...Array(window.bendDieLatT_raw.length).keys()];
	}
	return [];
}

function nearestIndex(arr, target) {
	let bestIdx = 0;
	let bestDiff = Infinity;
	for (let i = 0; i < arr.length; i++) {
		const diff = Math.abs(arr[i] - target);
		if (diff < bestDiff) {
			bestDiff = diff;
			bestIdx = i;
		}
	}
	return bestIdx;
}

function buildLegendHTML(title, defs) {
	const rows = defs
		.map((def) => {
			return `
			<div class="plot-legend-row">
				<span class="plot-legend-swatch" style="background:${def.color}"></span>
				<span>${def.label} [${def.unit}]</span>
			</div>
		`;
		})
		.join("");

	return `
		<div class="plot-legend-title">${title} signals</div>
		${rows}
	`;
}

function buildTooltipHTML(u, defs, idx, actualTime) {
	const displayT = u.data[0][idx];
	const realT = actualTime[idx];

	const rows = defs
		.map((def) => {
			const raw = def.raw[idx];
			const rawText = Number.isFinite(raw) ? raw.toFixed(4) : "NaN";
			return `
			<div class="plot-tooltip-row">
				<span class="plot-legend-swatch" style="background:${def.color}"></span>
				<span>${def.label}: ${rawText} ${def.unit}</span>
			</div>
		`;
		})
		.join("");

	return `
		<div class="plot-tooltip-title">
			Normalized Time: ${Number.isFinite(displayT) ? displayT.toFixed(2) : "NaN"}<br>
			Actual Time: ${Number.isFinite(realT) ? realT.toFixed(4) : "NaN"} s
		</div>
		${rows}
	`;
}

function syncVideoToIndex(idx, togglePlayback = false) {
	if (!VIDEO_ENABLED || !vid || GLOBAL_ACTUAL_TIME.length === 0 || vid.duration === 0) return;

	const t0 = GLOBAL_ACTUAL_TIME[0];
	const t1 = GLOBAL_ACTUAL_TIME[GLOBAL_ACTUAL_TIME.length - 1];
	const actualT = GLOBAL_ACTUAL_TIME[idx];

	if (!Number.isFinite(actualT) || t1 === t0) return;

	const ratio = (actualT - t0) / (t1 - t0);
	vid.currentTime = Math.max(0, Math.min(vid.duration, ratio * vid.duration));

	if (togglePlayback) {
		if (vid.paused) vid.play();
		else vid.pause();
	}
}

function syncPlotsToIndex(idx) {
	if (idx == null || idx < 0 || idx >= GLOBAL_DISPLAY_TIME.length) return;
	const xVal = GLOBAL_DISPLAY_TIME[idx];
	ALL_PLOTS.forEach((p) => {
		p.setCursor({ left: p.valToPos(xVal, "x") });
	});
}

function createPanel(title, defs, plots) {
	const panel = d.createElement("div");
	panel.className = "plot-panel";

	const titleEl = d.createElement("div");
	titleEl.className = "plot-title";
	titleEl.textContent = title;
	panel.appendChild(titleEl);

	const legend = d.createElement("div");
	legend.className = "plot-legend";
	legend.innerHTML = buildLegendHTML(title, defs);
	panel.appendChild(legend);

	const tooltip = d.createElement("div");
	tooltip.className = "plot-tooltip";
	panel.appendChild(tooltip);

	const chartHolder = d.createElement("div");
	panel.appendChild(chartHolder);

	const actualTime = GLOBAL_ACTUAL_TIME;
	const displayTime = GLOBAL_DISPLAY_TIME;
	const normSeries = defs.map((def) => normalizeSeries(def.raw));
	const data = [displayTime, ...normSeries];

	const series = [
		{ label: "Time", show: false },
		...defs.map((def) => ({
			label: def.label,
			stroke: def.color,
			width: 2,
		})),
	];

	const opts = {
		width: Math.max(700, window.innerWidth - 60),
		height: 250,
		series,
		legend: { show: false },
		cursor: {
			sync: { key: "toolSync" },
			drag: { x: true, y: false },
			focus: { prox: 16 },
		},
		scales: {
			x: { time: false },
			y: { auto: false, range: [0, 1] },
		},
		axes: [
			{
				label: "Normalized Time [0–1000]",
				grid: { show: true },
			},
			{
				label: "Normalized value",
				side: 1,
				grid: { show: true },
			},
		],
		hooks: {
			setCursor: [
				(u) => {
					const idx = u.cursor.idx;
					if (idx == null || idx < 0 || idx >= displayTime.length) {
						tooltip.style.display = "none";
						return;
					}

					tooltip.innerHTML = buildTooltipHTML(u, defs, idx, actualTime);
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

					u.over.addEventListener("click", () => {
						const idx = u.cursor.idx;
						if (idx == null || idx < 0 || idx >= displayTime.length) return;
						syncPlotsToIndex(idx);
						syncVideoToIndex(idx, true);
					});
				},
			],
		},
	};

	const plot = new uPlot(opts, data, chartHolder);
	plots.push(plot);

	return panel;
}

function getSeriesDefs() {
	return {
		bendDie: [
			{ key: "bendDieLatT", raw: numericArray(window.bendDieLatT_raw), label: "Lateral Torque", unit: "%", color: "red" },
			{ key: "bendDieRotT", raw: numericArray(window.bendDieRotT_raw), label: "Rotating Torque", unit: "%", color: "green" },
			{ key: "bendDieVerT", raw: numericArray(window.bendDieVerT_raw), label: "Vertical Torque", unit: "%", color: "blue" },
			{ key: "bendDieLatM", raw: numericArray(window.bendDieLatM_raw), label: "Lateral Movement", unit: "mm", color: "purple" },
			{ key: "bendDieRotA", raw: numericArray(window.bendDieRotA_raw), label: "Rotating Angle", unit: "°", color: "gray" },
			{ key: "bendDieVerM", raw: numericArray(window.bendDieVerM_raw), label: "Vertical Movement", unit: "mm", color: "brown" },
		],
		collet: [
			{ key: "colletAxT", raw: numericArray(window.colletAxT_raw), label: "Axial Torque", unit: "%", color: "red" },
			{ key: "colletRotT", raw: numericArray(window.colletRotT_raw), label: "Rotating Torque", unit: "%", color: "green" },
			{ key: "colletAxMov", raw: numericArray(window.colletAxMov_raw), label: "Axial Movement", unit: "mm", color: "blue" },
			{ key: "colletRotMov", raw: numericArray(window.colletRotMov_raw), label: "Rotating Movement", unit: "mm", color: "purple" },
		],
		mandrel: [
			{ key: "mandrelAxLoad", raw: numericArray(window.mandrelAxLoad_raw), label: "Axial Load", unit: "%", color: "red" },
			{ key: "mandrelAxMov", raw: numericArray(window.mandrelAxMov_raw), label: "Axial Movement", unit: "mm", color: "green" },
		],
		pressureDie: [
			{ key: "pressAxT", raw: numericArray(window.pressAxT_raw), label: "Axial Torque", unit: "%", color: "red" },
			{ key: "pressLatT", raw: numericArray(window.pressLatT_raw), label: "Lateral Torque", unit: "%", color: "green" },
			{ key: "pressLeftAxT", raw: numericArray(window.pressLeftAxT_raw), label: "Left Axial Torque", unit: "%", color: "blue" },
			{ key: "pressAxMov", raw: numericArray(window.pressAxMov_raw), label: "Axial Movement", unit: "mm", color: "purple" },
			{ key: "pressLatMov", raw: numericArray(window.pressLatMov_raw), label: "Lateral Movement", unit: "mm", color: "gray" },
			{ key: "pressLeftAxMov", raw: numericArray(window.pressLeftAxMov_raw), label: "Left Axial Movement", unit: "mm", color: "brown" },
		],
		clampDie: [
			{ key: "clampLatT", raw: numericArray(window.clampLatT_raw), label: "Lateral Torque", unit: "%", color: "red" },
			{ key: "clampLatMov", raw: numericArray(window.clampLatMov_raw), label: "Lateral Movement", unit: "mm", color: "green" },
		],
	};
}

function setInfoBlock() {
	const infoText = d.getElementById("infotext");
	if (!infoText) return;

	const extra = [
		info || "",
		"",
		"Display mode: normalized per tool window",
		"X-axis: normalized time [0–1000]",
		"Hover shows normalized time, actual time, and raw values.",
		"Click in any plot to jump video and play/pause.",
	].join("\n");

	infoText.textContent = extra;
}

function setVideoSource() {
	if (!vid) return;

	const primaryPath = `${proc.value}.mov`;
	const fallbackPath = "79.mov";

	VIDEO_ENABLED = false;
	vid.poster = "overview.jpg";

	vid.onerror = function () {
		if (vid.src.includes(primaryPath) && primaryPath !== fallbackPath) {
			console.warn(`Video not found: ${primaryPath}. Falling back to ${fallbackPath}`);
			vid.onerror = function () {
				VIDEO_ENABLED = false;
				vid.removeAttribute("src");
				vid.poster = "overview.jpg";
				vid.load();
				console.warn(`Fallback video also not found: ${fallbackPath}`);
			};
			vid.src = fallbackPath;
			vid.load();
		} else {
			VIDEO_ENABLED = false;
			vid.removeAttribute("src");
			vid.poster = "overview.jpg";
			vid.load();
		}
	};

	vid.onloadeddata = function () {
		VIDEO_ENABLED = true;
	};

	vid.src = primaryPath;
	vid.load();
}
function bindVideoTracking() {
	if (!vid) return;

	vid.ontimeupdate = function () {
		if (!VIDEO_ENABLED || GLOBAL_ACTUAL_TIME.length === 0 || vid.duration === 0) return;

		const t0 = GLOBAL_ACTUAL_TIME[0];
		const t1 = GLOBAL_ACTUAL_TIME[GLOBAL_ACTUAL_TIME.length - 1];
		if (t1 === t0) return;

		const ratio = vid.currentTime / vid.duration;
		const actualT = t0 + ratio * (t1 - t0);
		const idx = nearestIndex(GLOBAL_ACTUAL_TIME, actualT);

		syncPlotsToIndex(idx);
	};
}

function plotData() {
	injectStyles();
	setVideoSource();

	GLOBAL_ACTUAL_TIME = getTimeAxis();
	GLOBAL_DISPLAY_TIME = normalizeTimeAxis(GLOBAL_ACTUAL_TIME, 0, 1000);
	ALL_PLOTS = [];

	setInfoBlock();

	const oldRoot = d.getElementById("plotsRoot");
	if (oldRoot) oldRoot.remove();

	const plotsRoot = d.createElement("div");
	plotsRoot.id = "plotsRoot";

	const note = d.createElement("div");
	note.className = "note-block";
	note.textContent =
		"Plots are normalized per tool for readability. Hover to see normalized time, actual time, and raw values. Click any plot to sync the video.";
	plotsRoot.appendChild(note);

	const defs = getSeriesDefs();

	plotsRoot.appendChild(createPanel("Bend Die", defs.bendDie, ALL_PLOTS));
	plotsRoot.appendChild(createPanel("Collet", defs.collet, ALL_PLOTS));
	plotsRoot.appendChild(createPanel("Mandrel", defs.mandrel, ALL_PLOTS));
	plotsRoot.appendChild(createPanel("Pressure Die", defs.pressureDie, ALL_PLOTS));
	plotsRoot.appendChild(createPanel("Clamp Die", defs.clampDie, ALL_PLOTS));

	d.body.appendChild(plotsRoot);

	function resizePlots() {
		const width = Math.max(700, window.innerWidth - 60);
		ALL_PLOTS.forEach((p) => p.setSize({ width, height: 250 }));
	}

	window.addEventListener("resize", resizePlots);
	bindVideoTracking();
}

loadScript(`dta${proc.value}.js`, plotData, function () {
    const infoText = d.getElementById("infotext");
    const msg = `Data file for process ${proc.value} is unavailable or corrupted.`;
    
    if (infoText) {
        infoText.textContent = msg;
        infoText.style.color = "red";
    }
    alert(msg);
});