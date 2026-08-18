// ============================================================
// GeometryEngine – The data processor for tube geometry
// ============================================================
// This object contains all the logic to:
//   1. Process the raw linear‑arc‑linear data into a single continuous array.
//   2. Build the 3D centreline path from the measured angles and radii.
//   3. Normalise arrays for plotting.
//
// It is used by geometry.html to prepare the data before rendering.
// ============================================================
const GeometryEngine = {
    // ============================================================
    // processData(geoL1, geoArc, geoL2)
    // ============================================================
    // What it does:
    //   - Reverses Linear 1 data so that the graph flows smoothly from the start.
    //   - Removes the first point of the arc to avoid duplication at the joint.
    //   - Concatenates Linear 1 (reversed), Arc (sliced), and Linear 2 into one array.
    //   - Computes the "true collapse" using the formula:
    //         (main_axis / 2) - baseRadius + collapse
    //     This gives the actual inward shift of the cross‑section.
    //
    // Why this matters:
    //   - The raw data from the pickle file is split into three sections.
    //   - For the graph to show a continuous line, we need to reorder and stitch them.
    //   - The true collapse is used later to deform the tube only on the inner side.
    // ============================================================
    processData: function(geoL1, geoArc, geoL2) {
        // Fallback to 11.0 if not defined globally
        const baseR = window.cross_section_radius || window.tube_radius || 11.0; 

        // Helper function to calculate the true collapse deviation
        const calculateTrueCollapse = (mainArr, colArr) => {
            return mainArr.map((main, i) => {
                const rawCol = colArr[i] !== undefined ? colArr[i] : 0;
                return (main / 2) - baseR + rawCol;
            });
        };

        const l1_main_rev = [...geoL1.main_axis].reverse();
        const l1_sec_rev = [...geoL1.secondary_axis].reverse();
        const l1_col_rev = [...geoL1.collapse].reverse();
        const l1_oor_rev = [...geoL1.out_of_roundness].reverse();
        const l1_x_rev = [...geoL1.x].reverse();

        // Calculate true collapse for L1
        const l1_true_col = calculateTrueCollapse(l1_main_rev, l1_col_rev);

        // Slice index 0 to treat the transition smoothly
        const arc_main_sliced = geoArc.main_axis.slice(1);
        const arc_sec_sliced = geoArc.secondary_axis.slice(1);
        const arc_col_sliced = geoArc.collapse.slice(1);
        const arc_oor_sliced = geoArc.out_of_roundness.slice(1);
        const arc_x_sliced = geoArc.x.slice(1);

        // Calculate true collapse for Arc
        const arc_true_col = calculateTrueCollapse(arc_main_sliced, arc_col_sliced);

        // Calculate true collapse for L2
        const l2_true_col = calculateTrueCollapse(geoL2.main_axis, geoL2.collapse);

        return {
            main: [...l1_main_rev, ...arc_main_sliced, ...geoL2.main_axis],
            sec: [...l1_sec_rev, ...arc_sec_sliced, ...geoL2.secondary_axis],
            // Now contains the formula output instead of raw values
            col: [...l1_true_col, ...arc_true_col, ...l2_true_col], 
            oor: [...l1_oor_rev, ...arc_oor_sliced, ...geoL2.out_of_roundness],
            totalPoints: geoL1.x.length + arc_x_sliced.length + geoL2.x.length,
            l1_rev: {
                x: l1_x_rev,
                secondary_axis: l1_sec_rev,
                main_axis: l1_main_rev,
                out_of_roundness: l1_oor_rev,
                collapse: l1_true_col, 
                section_name: geoL1.section_name
            },
            arc_sliced: {
                x: arc_x_sliced,
                secondary_axis: arc_sec_sliced,
                main_axis: arc_main_sliced,
                out_of_roundness: arc_oor_sliced,
                collapse: arc_true_col, 
                section_name: geoArc.section_name
            }
        };
    },
     // ============================================================
    // buildPath(geoL1, geoArc, geoL2)
    // ============================================================
    // What it does:
    //   - Builds the 3D centreline of the tube.
    //   - Linear 1: straight line along the X‑axis.
    //   - Arc: circular bend derived from the bending angle and radius.
    //   - Linear 2: straight line continuing in the exit direction of the arc.
    //
    // The key steps:
    //   1. The total bending angle is read from the data (or defaults to 45°).
    //   2. The bend radius is calculated as: ArcL / angleRad.
    //   3. The arc is constructed point by point using sin/cos.
    //   4. A small padding (1 mm) is added to avoid overlapping vertices.
    //
    // Why this matters:
    //   - This path is the backbone of the 3D tube.
    //   - Without it, we would not know where to place each cross‑section.
    // ============================================================
    buildPath: function(geoL1, geoArc, geoL2) {
        const calculatedPositions = [];
        const calculatedTangents = [];

        const ArcL = geoArc.x[geoArc.x.length - 1];
        const nativeAngleDeg = window.bend_angle_deg !== undefined ? window.bend_angle_deg : 45.0;
        const angleRad = nativeAngleDeg * Math.PI / 180;
        const bendR = ArcL / angleRad;

        // Linear 1
        const len1 = geoL1.x.length;
        for (let i = 0; i < len1; i++) {
            const dist = geoL1.x[i]; 
            calculatedPositions.push(new THREE.Vector3(dist, 0, 0));
            calculatedTangents.push(new THREE.Vector3(1, 0, 0));
        }

        // Arc section
        const lenArc = geoArc.x.length;
        const L1_End = geoL1.x[len1 - 1] + 1.0; 
        
        for (let i = 1; i < lenArc; i++) {
            const r = (geoArc.x[i] / ArcL) * angleRad;
            const pos = new THREE.Vector3(L1_End + bendR * Math.sin(r), 0, -bendR + bendR * Math.cos(r));
            const tan = new THREE.Vector3(Math.cos(r), 0, -Math.sin(r)).normalize();
            calculatedPositions.push(pos);
            calculatedTangents.push(tan);
        }

        // Linear 2
        const len2 = geoL2.x.length;
        const arcEndPos = calculatedPositions[calculatedPositions.length - 1];
        const exitTan = calculatedTangents[calculatedTangents.length - 1];
        for (let i = 0; i < len2; i++) {
            const dist = geoL2.x[i]; 
            const pos = new THREE.Vector3(
                arcEndPos.x + dist * exitTan.x,
                0,
                arcEndPos.z + dist * exitTan.z
            );
            calculatedPositions.push(pos);
            calculatedTangents.push(exitTan);
        }

        return { positions: calculatedPositions, tangents: calculatedTangents, angleDeg: nativeAngleDeg };
    },
    // ============================================================
    // normalize(arr)
    // ============================================================
    // What it does:
    //   - Scales an array to the range [0, 1].
    //   - If all values are the same, it returns an array of zeros.
    //
    // Why this matters:
    //   - The graph shows all metrics on the same scale (0 to 1.1).
    //   - Normalisation makes it easy to compare different metrics visually.
    // ============================================================
    normalize: function(arr) {
        const min = Math.min(...arr), max = Math.max(...arr);
        return (max - min === 0) ? arr.map(() => 0) : arr.map(v => (v - min) / (max - min));
    }
};
