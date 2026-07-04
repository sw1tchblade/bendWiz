const GeometryEngine = {
    processData: function(geoL1, geoArc, geoL2) {
        const l1_main_rev = [...geoL1.main_axis].reverse();
        const l1_sec_rev = [...geoL1.secondary_axis].reverse();
        const l1_col_rev = [...geoL1.collapse].reverse();
        const l1_oor_rev = [...geoL1.out_of_roundness].reverse();
        const l1_x_rev = [...geoL1.x].reverse();

        // Slice index 0 to treat the transition smoothly
        const arc_main_sliced = geoArc.main_axis.slice(1);
        const arc_sec_sliced = geoArc.secondary_axis.slice(1);
        const arc_col_sliced = geoArc.collapse.slice(1);
        const arc_oor_sliced = geoArc.out_of_roundness.slice(1);
        const arc_x_sliced = geoArc.x.slice(1);

        return {
            main: [...l1_main_rev, ...arc_main_sliced, ...geoL2.main_axis],
            sec: [...l1_sec_rev, ...arc_sec_sliced, ...geoL2.secondary_axis],
            col: [...l1_col_rev, ...arc_col_sliced, ...geoL2.collapse],
            oor: [...l1_oor_rev, ...arc_oor_sliced, ...geoL2.out_of_roundness],
            totalPoints: geoL1.x.length + arc_x_sliced.length + geoL2.x.length,
            l1_rev: {
                x: l1_x_rev,
                secondary_axis: l1_sec_rev,
                main_axis: l1_main_rev,
                out_of_roundness: l1_oor_rev,
                collapse: l1_col_rev,
                section_name: geoL1.section_name
            },
            arc_sliced: {
                x: arc_x_sliced,
                secondary_axis: arc_sec_sliced,
                main_axis: arc_main_sliced,
                out_of_roundness: arc_oor_sliced,
                collapse: arc_col_sliced,
                section_name: geoArc.section_name
            }
        };
    },

    buildPath: function(geoL1, geoArc, geoL2) {
        const calculatedPositions = [];
        const calculatedTangents = [];

        const ArcL = geoArc.x[geoArc.x.length - 1];
        const nativeAngleDeg = window.bend_angle_deg !== undefined ? window.bend_angle_deg : 45.0;
        const angleRad = nativeAngleDeg * Math.PI / 180;
        const bendR = ArcL / angleRad;

        // Linear 1: Standard 2mm mapping
        const len1 = geoL1.x.length;
        for (let i = 0; i < len1; i++) {
            const dist = geoL1.x[i]; 
            calculatedPositions.push(new THREE.Vector3(dist, 0, 0));
            calculatedTangents.push(new THREE.Vector3(1, 0, 0));
        }

        // Arc section: Anchor position pushed forward by 1mm to create an exact 2mm total step gap
        const lenArc = geoArc.x.length;
        const L1_End = geoL1.x[len1 - 1] + 1.0; // Padded threshold shifts anchor forward
        
        for (let i = 1; i < lenArc; i++) {
            const r = (geoArc.x[i] / ArcL) * angleRad;
            const pos = new THREE.Vector3(L1_End + bendR * Math.sin(r), 0, -bendR + bendR * Math.cos(r));
            const tan = new THREE.Vector3(Math.cos(r), 0, -Math.sin(r)).normalize();
            calculatedPositions.push(pos);
            calculatedTangents.push(tan);
        }

        // Linear 2: Continues smoothly from the modified curve layout
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

    normalize: function(arr) {
        const min = Math.min(...arr), max = Math.max(...arr);
        return (max - min === 0) ? arr.map(() => 0) : arr.map(v => (v - min) / (max - min));
    }
};
