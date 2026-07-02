const GeometryEngine = {
    processData: function(geoL1, geoArc, geoL2) {
        const l1_main_rev = [...geoL1.main_axis].reverse();
        const l1_sec_rev = [...geoL1.secondary_axis].reverse();
        const l1_col_rev = [...geoL1.collapse].reverse();
        const l1_oor_rev = [...geoL1.out_of_roundness].reverse();
        const l1_x_rev = [...geoL1.x].reverse();

        return {
            main: [...l1_main_rev, ...geoArc.main_axis, ...geoL2.main_axis],
            sec: [...l1_sec_rev, ...geoArc.secondary_axis, ...geoL2.secondary_axis],
            col: [...l1_col_rev, ...geoArc.collapse, ...geoL2.collapse],
            oor: [...l1_oor_rev, ...geoArc.out_of_roundness, ...geoL2.out_of_roundness],
            totalPoints: geoL1.x.length + geoArc.x.length + geoL2.x.length,
            l1_rev: {
                x: l1_x_rev,
                secondary_axis: l1_sec_rev,
                main_axis: l1_main_rev,
                out_of_roundness: l1_oor_rev,
                collapse: l1_col_rev,
                section_name: geoL1.section_name
            }
        };
    },

    buildPath: function(geoL1, geoArc, geoL2) {
        const calculatedPositions = [];
        const calculatedTangents = [];

        // Fetch physical arc length from the sensor dataset directly
        const ArcL = geoArc.x[geoArc.x.length - 1];
        const nativeAngleDeg = window.bend_angle_deg !== undefined ? window.bend_angle_deg : 45.0;
        const angleRad = nativeAngleDeg * Math.PI / 180;
        const bendR = ArcL / angleRad;

        // Linear 1: Use raw array elements directly to enforce strict 2mm intervals
        const len1 = geoL1.x.length;
        for (let i = 0; i < len1; i++) {
            const dist = geoL1.x[i]; 
            calculatedPositions.push(new THREE.Vector3(dist, 0, 0));
            calculatedTangents.push(new THREE.Vector3(1, 0, 0));
        }

        // Arc section: Retains its dense curve sweep
        const lenArc = geoArc.x.length;
        for (let i = 0; i < lenArc; i++) {
            const r = (geoArc.x[i] / ArcL) * angleRad;
            const L1_End = geoL1.x[len1 - 1];
            const pos = new THREE.Vector3(L1_End + bendR * Math.sin(r), 0, -bendR + bendR * Math.cos(r));
            const tan = new THREE.Vector3(Math.cos(r), 0, -Math.sin(r)).normalize();
            calculatedPositions.push(pos);
            calculatedTangents.push(tan);
        }

        // Linear 2: Extrude directly using native array increments for perfect 2mm steps
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
};const GeometryEngine = {
    processData: function(geoL1, geoArc, geoL2) {
        const l1_main_rev = [...geoL1.main_axis].reverse();
        const l1_sec_rev = [...geoL1.secondary_axis].reverse();
        const l1_col_rev = [...geoL1.collapse].reverse();
        const l1_oor_rev = [...geoL1.out_of_roundness].reverse();
        const l1_x_rev = [...geoL1.x].reverse();

        return {
            main: [...l1_main_rev, ...geoArc.main_axis, ...geoL2.main_axis],
            sec: [...l1_sec_rev, ...geoArc.secondary_axis, ...geoL2.secondary_axis],
            col: [...l1_col_rev, ...geoArc.collapse, ...geoL2.collapse],
            oor: [...l1_oor_rev, ...geoArc.out_of_roundness, ...geoL2.out_of_roundness],
            totalPoints: geoL1.x.length + geoArc.x.length + geoL2.x.length,
            l1_rev: {
                x: l1_x_rev,
                secondary_axis: l1_sec_rev,
                main_axis: l1_main_rev,
                out_of_roundness: l1_oor_rev,
                collapse: l1_col_rev,
                section_name: geoL1.section_name
            }
        };
    },

    buildPath: function(geoL1, geoArc, geoL2) {
        const calculatedPositions = [];
        const calculatedTangents = [];

        const L1 = geoL1.x[geoL1.x.length - 1];
        const ArcL = geoArc.x[geoArc.x.length - 1];
        const L2 = geoL2.x[geoL2.x.length - 1];
        
        // REMOVED: Trigonometric approximation math blocks completely deleted
        // FIXED: Using raw physics sensor property directly from data payload
        const nativeAngleDeg = window.bend_angle_deg !== undefined ? window.bend_angle_deg : 45.0;
        const angleRad = nativeAngleDeg * Math.PI / 180;
        const bendR = ArcL / angleRad;

        const len1 = geoL1.x.length;
        for (let i = 0; i < len1; i++) {
            const dist = (i / (len1 - 1)) * L1;
            calculatedPositions.push(new THREE.Vector3(dist, 0, 0));
            calculatedTangents.push(new THREE.Vector3(1, 0, 0));
        }

        const lenArc = geoArc.x.length;
        for (let i = 0; i < lenArc; i++) {
            const r = (geoArc.x[i] / ArcL) * angleRad;
            const pos = new THREE.Vector3(L1 + bendR * Math.sin(r), 0, -bendR + bendR * Math.cos(r));
            const tan = new THREE.Vector3(Math.cos(r), 0, -Math.sin(r)).normalize();
            calculatedPositions.push(pos);
            calculatedTangents.push(tan);
        }

        const len2 = geoL2.x.length;
        const arcEndPos = calculatedPositions[calculatedPositions.length - 1];
        const exitTan = calculatedTangents[calculatedTangents.length - 1];
        for (let i = 0; i < len2; i++) {
            const dist = (i / (len2 - 1)) * L2;
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
