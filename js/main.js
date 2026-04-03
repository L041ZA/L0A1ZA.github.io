(function () {
    "use strict";

    var DATA_PATH = "data/tickers_summary.json";
    var allTickers = [];
    var activeTicker = null;
    var activePeriod = "1d";
    var compareMode = false;
    var MACRO_ORDER = ["^GSPC", "^VIX", "DX-Y.NYB", "BTC-USD", "CL=F", "GC=F"];

    /* ═══════════════════════════════════════════════════════
       THREE.JS SHADER BACKGROUND — exact AnoAI component
       ═══════════════════════════════════════════════════════ */
    function initShaderBg() {
        var container = document.getElementById("shader-bg");
        if (!container || typeof THREE === "undefined") return;

        var scene = new THREE.Scene();
        var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        var renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(renderer.domElement);

        var material = new THREE.ShaderMaterial({
            uniforms: {
                iTime: { value: 0 },
                iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: "void main(){gl_Position=vec4(position,1.0);}",
            fragmentShader: [
                "uniform float iTime;",
                "uniform vec2 iResolution;",
                "#define NUM_OCTAVES 3",
                "float rand(vec2 n){return fract(sin(dot(n,vec2(12.9898,4.1414)))*43758.5453);}",
                "float noise(vec2 p){",
                "  vec2 ip=floor(p);vec2 u=fract(p);",
                "  u=u*u*(3.0-2.0*u);",
                "  float res=mix(mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),",
                "    mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);",
                "  return res*res;",
                "}",
                "float fbm(vec2 x){",
                "  float v=0.0;float a=0.3;vec2 shift=vec2(100);",
                "  mat2 rot=mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));",
                "  for(int i=0;i<NUM_OCTAVES;++i){v+=a*noise(x);x=rot*x*2.0+shift;a*=0.4;}",
                "  return v;",
                "}",
                "void main(){",
                "  vec2 shake=vec2(sin(iTime*1.2)*0.005,cos(iTime*2.1)*0.005);",
                "  vec2 p=((gl_FragCoord.xy+shake*iResolution.xy)-iResolution.xy*0.5)/iResolution.y*mat2(6.0,-4.0,4.0,6.0);",
                "  vec2 v;vec4 o=vec4(0.0);",
                "  float f=2.0+fbm(p+vec2(iTime*5.0,0.0))*0.5;",
                "  for(float i=0.0;i<35.0;i++){",
                "    v=p+cos(i*i+(iTime+p.x*0.08)*0.025+i*vec2(13.0,11.0))*3.5+vec2(sin(iTime*3.0+i)*0.003,cos(iTime*3.5-i)*0.003);",
                "    float tailNoise=fbm(v+vec2(iTime*0.5,i))*0.3*(1.0-(i/35.0));",
                "    vec4 auroraColors=vec4(0.1+0.3*sin(i*0.2+iTime*0.4),0.3+0.5*cos(i*0.3+iTime*0.5),0.7+0.3*sin(i*0.4+iTime*0.3),1.0);",
                "    vec4 currentContribution=auroraColors*exp(sin(i*i+iTime*0.8))/length(max(v,vec2(v.x*f*0.015,v.y*1.5)));",
                "    float thinnessFactor=smoothstep(0.0,1.0,i/35.0)*0.6;",
                "    o+=currentContribution*(1.0+tailNoise*0.8)*thinnessFactor;",
                "  }",
                "  o=tanh(pow(o/100.0,vec4(1.6)));",
                "  gl_FragColor=o*1.5;",
                "}"
            ].join("\n")
        });

        var geometry = new THREE.PlaneGeometry(2, 2);
        scene.add(new THREE.Mesh(geometry, material));

        function onResize() {
            renderer.setSize(window.innerWidth, window.innerHeight);
            material.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
        }
        window.addEventListener("resize", onResize);

        (function animate() {
            material.uniforms.iTime.value += 0.016;
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        })();
    }

    /* ═══════════════════════════════════════════════════════
       ANIMATED GRADIENT OVERLAY
       ═══════════════════════════════════════════════════════ */
    function initGradient() {
        var el = document.getElementById("gradient-bg");
        if (!el) return;

        var gap = 130, dir = 1;
        var colors = ["#000","#020610","#06101f","#0a1a35","#06101f","#020610","#000"];
        var stops  = [5, 20, 38, 52, 65, 82, 100];

        (function loop() {
            if (gap >= 134) dir = -1;
            if (gap <= 126) dir = 1;
            gap += dir * 0.015;
            var s = stops.map(function (v, i) { return colors[i] + " " + v + "%"; }).join(",");
            el.style.background = "radial-gradient(" + gap + "% " + gap + "% at 50% 30%," + s + ")";
            requestAnimationFrame(loop);
        })();
    }

    /* ═══════════════════════════════════════════════════════
       NAV SCROLL
       ═══════════════════════════════════════════════════════ */
    function initNav() {
        var nav = document.getElementById("nav");
        if (!nav) return;
        window.addEventListener("scroll", function () {
            nav.classList.toggle("scrolled", window.scrollY > 50);
        }, { passive: true });
    }

    /* ═══════════════════════════════════════════════════════
       SCROLL REVEAL
       ═══════════════════════════════════════════════════════ */
    function initReveal() {
        var els = document.querySelectorAll(".fade-in");
        if (!els.length) return;
        var obs = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add("visible");
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.08, rootMargin: "0px 0px -20px 0px" });
        els.forEach(function (el) { obs.observe(el); });
    }

    /* ═══════════════════════════════════════════════════════
       PRICE FORMATTING
       ═══════════════════════════════════════════════════════ */
    function fmtPrice(p) {
        if (p == null) return "--";
        if (p >= 1000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (p >= 10) return p.toFixed(2);
        return p.toFixed(4);
    }

    function sparklineValues(t) {
        var p5 = t.periods && t.periods["5d"];
        var p1 = t.periods && t.periods["1mo"];
        var p6 = t.periods && t.periods["6mo"];
        var src = (p5 && p5.v && p5.v.length >= 2) ? p5.v
            : (p1 && p1.v && p1.v.length >= 2) ? p1.v
            : (p6 && p6.v && p6.v.length >= 2) ? p6.v : null;
        if (!src) return [];
        var n = Math.min(30, src.length);
        return src.slice(-n);
    }

    function sparklineSvg(vals) {
        var w = 44;
        var h = 16;
        if (!vals || vals.length < 2) return "";
        var min = Math.min.apply(null, vals);
        var max = Math.max.apply(null, vals);
        var rng = max - min || 1e-9;
        var pad = 1;
        var pts = [];
        for (var i = 0; i < vals.length; i++) {
            var x = pad + (i / (vals.length - 1)) * (w - 2 * pad);
            var y = h - pad - ((vals[i] - min) / rng) * (h - 2 * pad);
            pts.push(x.toFixed(1) + "," + y.toFixed(1));
        }
        var stroke = vals[vals.length - 1] >= vals[0] ? "#00e87b" : "#ff4d4d";
        return '<svg class="tape-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true">' +
            '<polyline fill="none" stroke="' + stroke + '" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" points="' + pts.join(" ") + '"/>' +
            "</svg>";
    }

    /* ═══════════════════════════════════════════════════════
       TICKER TAPE (clickable)
       ═══════════════════════════════════════════════════════ */
    function buildTape(tickers) {
        var track = document.getElementById("tape-track");
        if (!track) return;

        function item(t) {
            var up = t.chg >= 0;
            var alertCls = Math.abs(t.chg) >= 5 ? " tape-item--alert" : "";
            var spark = sparklineSvg(sparklineValues(t));
            return '<span class="tape-item' + alertCls + '" data-sym="' + t.symbol + '">' +
                spark +
                '<span class="tape-sym">' + t.symbol + '</span>' +
                '<span class="tape-price">' + fmtPrice(t.price) + '</span>' +
                '<span class="tape-chg ' + (up ? "up" : "down") + '">' +
                    (up ? "+" : "") + t.chg.toFixed(2) + '%</span>' +
            '</span>';
        }

        var html = "";
        tickers.forEach(function (t) { html += item(t); });
        tickers.forEach(function (t) { html += item(t); });
        track.innerHTML = html;

        requestAnimationFrame(function () {
            var w = track.scrollWidth / 2;
            var duration = Math.max(w / 35, 120);
            track.parentElement.style.setProperty("--tape-duration", duration + "s");
        });

        track.addEventListener("click", function (e) {
            var el = e.target.closest(".tape-item");
            if (!el) return;
            selectTicker(el.getAttribute("data-sym"));
        });
    }

    /* ═══════════════════════════════════════════════════════
       SEARCH — dropdown with results
       ═══════════════════════════════════════════════════════ */
    function initSearch() {
        var input = document.getElementById("ticker-search");
        var dropdown = document.getElementById("search-dropdown");
        if (!input || !dropdown) return;

        var debounce;
        input.addEventListener("input", function () {
            clearTimeout(debounce);
            debounce = setTimeout(function () {
                var q = input.value.trim().toLowerCase();
                if (!q) { dropdown.classList.remove("open"); return; }
                var matches = allTickers.filter(function (t) {
                    return t.symbol.toLowerCase().indexOf(q) !== -1 ||
                           t.name.toLowerCase().indexOf(q) !== -1;
                }).slice(0, 10);
                renderDropdown(matches, dropdown);
            }, 150);
        });

        input.addEventListener("focus", function () {
            if (input.value.trim()) input.dispatchEvent(new Event("input"));
        });

        document.addEventListener("click", function (e) {
            if (!e.target.closest("#search-wrap")) dropdown.classList.remove("open");
        });

        dropdown.addEventListener("click", function (e) {
            var item = e.target.closest(".dd-item");
            if (!item) return;
            selectTicker(item.getAttribute("data-sym"));
            input.value = "";
            dropdown.classList.remove("open");
        });
    }

    function renderDropdown(matches, dd) {
        if (!matches.length) { dd.classList.remove("open"); return; }
        var html = "";
        matches.forEach(function (t) {
            var up = t.chg >= 0;
            html += '<div class="dd-item" data-sym="' + t.symbol + '">' +
                '<div class="dd-left"><span class="dd-sym">' + t.symbol + '</span><span class="dd-name">' + t.name + '</span></div>' +
                '<div class="dd-right"><span class="dd-price">' + fmtPrice(t.price) + '</span>' +
                '<span class="dd-chg ' + (up ? "up" : "down") + '">' + (up ? "+" : "") + t.chg.toFixed(2) + '%</span></div>' +
            '</div>';
        });
        dd.innerHTML = html;
        dd.classList.add("open");
    }

    /* ═══════════════════════════════════════════════════════
       SELECT TICKER
       ═══════════════════════════════════════════════════════ */
    function selectTicker(sym) {
        var t = allTickers.find(function (x) { return x.symbol === sym; });
        if (!t) return;
        activeTicker = t;
        activePeriod = "1d";
        compareMode = false;
        prefillCompareA(sym);
        renderHeader(t);
        renderChartOrCompare();
        renderStats(t);
        updatePeriodButtons("1d");
    }

    function renderMacroStrip(tickers) {
        var el = document.getElementById("macro-strip");
        if (!el) return;
        var map = {};
        tickers.forEach(function (t) { map[t.symbol] = t; });
        var html = "";
        MACRO_ORDER.forEach(function (sym) {
            var t = map[sym];
            if (!t) return;
            var up = t.chg >= 0;
            html +=
                '<div class="macro-cell" data-glow title="' + t.name + '">' +
                    '<div class="glow-border"></div>' +
                    '<div class="macro-cell-inner">' +
                        '<div class="macro-cell-name">' + t.name + '</div>' +
                        '<div class="macro-cell-row">' +
                            '<span class="macro-cell-sym">' + t.symbol + '</span>' +
                            '<span class="macro-cell-price">' + fmtPrice(t.price) + '</span>' +
                        '</div>' +
                        '<div class="macro-cell-chg ' + (up ? "up" : "down") + '">' +
                            (up ? "+" : "") + t.chg.toFixed(2) + "%" +
                        "</div>" +
                    "</div>" +
                "</div>";
        });
        el.innerHTML = html || '<span class="terminal-sub">Macro data loading…</span>';
    }

    var cmpSelectedA = "";
    var cmpSelectedB = "";

    function initCompareSearch(inputId, ddId, wrapId, setter) {
        var input = document.getElementById(inputId);
        var dd = document.getElementById(ddId);
        if (!input || !dd) return;

        var debounce;
        input.addEventListener("input", function () {
            clearTimeout(debounce);
            debounce = setTimeout(function () {
                var q = input.value.trim().toLowerCase();
                if (!q) { dd.classList.remove("open"); return; }
                var matches = allTickers.filter(function (t) {
                    return t.symbol.toLowerCase().indexOf(q) !== -1 ||
                           t.name.toLowerCase().indexOf(q) !== -1;
                }).slice(0, 8);
                if (!matches.length) { dd.classList.remove("open"); return; }
                var html = "";
                matches.forEach(function (t) {
                    html += '<div class="cmp-dd-item" data-sym="' + t.symbol + '">' +
                        '<span><span class="cmp-dd-sym">' + t.symbol + '</span><span class="cmp-dd-name">' + t.name + '</span></span>' +
                    '</div>';
                });
                dd.innerHTML = html;
                dd.classList.add("open");
            }, 120);
        });

        input.addEventListener("focus", function () {
            if (input.value.trim()) input.dispatchEvent(new Event("input"));
        });

        dd.addEventListener("click", function (e) {
            var item = e.target.closest(".cmp-dd-item");
            if (!item) return;
            var sym = item.getAttribute("data-sym");
            var t = allTickers.find(function (x) { return x.symbol === sym; });
            input.value = t ? t.symbol + " · " + t.name : sym;
            input.classList.add("cmp-locked");
            setter(sym);
            dd.classList.remove("open");
        });

        document.addEventListener("click", function (e) {
            if (!e.target.closest("#" + wrapId)) dd.classList.remove("open");
        });
    }

    function prefillCompareA(sym) {
        var input = document.getElementById("compare-a");
        if (!input) return;
        var t = allTickers.find(function (x) { return x.symbol === sym; });
        if (t) {
            input.value = t.symbol + " · " + t.name;
            input.classList.add("cmp-locked");
            cmpSelectedA = sym;
        }
    }

    /* ═══════════════════════════════════════════════════════
       DETAIL HEADER
       ═══════════════════════════════════════════════════════ */
    function renderHeader(t) {
        var el = document.getElementById("detail-header");
        if (!el) return;
        var up = t.chg >= 0;
        var sign = up ? "+" : "";
        var cls = up ? "up" : "down";
        var absStr = t.chg_abs != null ? (sign + fmtPrice(Math.abs(t.chg_abs))) : "";

        var egg = EASTER_EGGS[t.symbol];
        var eggHtml = egg ? '<div class="easter-egg"><div class="easter-egg-inner">' + egg + '</div></div>' : '';

        el.innerHTML =
            '<h3 class="detail-name">' + t.name + ' <span class="detail-sym">(' + t.symbol + ')</span></h3>' +
            '<div class="detail-price-row">' +
                '<span class="detail-price">' + fmtPrice(t.price) + '</span>' +
                '<span class="detail-change ' + cls + '">' + absStr + ' (' + sign + t.chg.toFixed(2) + '%)</span>' +
            '</div>' +
            '<div class="detail-updated">Hourly update &middot; Data by Yahoo Finance &middot; Possible 15 min delay</div>' +
            eggHtml;
    }

    /* ═══════════════════════════════════════════════════════
       DETAIL CHART (Plotly) — linear shape, proper Y range
       ═══════════════════════════════════════════════════════ */
    /** Few, readable X ticks (same rules for single-ticker and compare charts). */
    function getSparseXTicks(tLabels, period) {
        var xTickVals = [];
        var xTickText = [];
        if (!tLabels || !tLabels.length) return { tickvals: xTickVals, ticktext: xTickText };

        if (period === "1d") {
            var seen = {};
            for (var i = 0; i < tLabels.length; i++) {
                var parts = tLabels[i].split(":");
                var hh = parseInt(parts[0], 10);
                var mm = parseInt(parts[1], 10);
                if (mm === 0 && !seen[hh] && hh % 2 === 0) {
                    seen[hh] = true;
                    var h12 = hh % 12 || 12;
                    var ampm = hh < 12 ? "AM" : "PM";
                    xTickVals.push(tLabels[i]);
                    xTickText.push(h12 + ":00 " + ampm);
                }
            }
            if (xTickVals.length < 2) {
                var step1d = Math.max(1, Math.floor(tLabels.length / 6));
                xTickVals = []; xTickText = [];
                for (var j = 0; j < tLabels.length; j += step1d) {
                    xTickVals.push(tLabels[j]);
                    xTickText.push(tLabels[j]);
                }
            }
        } else if (period === "5d") {
            var seenDates = {};
            for (var k = 0; k < tLabels.length; k++) {
                var dateKey = tLabels[k].split(" ")[0];
                if (!seenDates[dateKey]) {
                    seenDates[dateKey] = true;
                    var dp = dateKey.split("/");
                    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                    var mIdx = parseInt(dp[0], 10) - 1;
                    xTickVals.push(tLabels[k]);
                    xTickText.push(months[mIdx] + " " + parseInt(dp[1], 10));
                }
            }
            if (xTickVals.length > 8) {
                var thin = Math.ceil(xTickVals.length / 7);
                var nv = []; var nt = [];
                for (var q = 0; q < xTickVals.length; q += thin) {
                    nv.push(xTickVals[q]); nt.push(xTickText[q]);
                }
                if (nv[nv.length - 1] !== xTickVals[xTickVals.length - 1]) {
                    nv.push(xTickVals[xTickVals.length - 1]);
                    nt.push(xTickText[xTickText.length - 1]);
                }
                xTickVals = nv; xTickText = nt;
            }
        } else {
            /* 1mo, 6mo — daily dates YYYY-MM-DD */
            var maxTicks = 8;
            var step = Math.max(1, Math.floor(tLabels.length / maxTicks));
            for (var m = 0; m < tLabels.length; m += step) {
                xTickVals.push(tLabels[m]);
                xTickText.push(tLabels[m]);
            }
        }

        return { tickvals: xTickVals, ticktext: xTickText };
    }

    function renderChart(t, period) {
        var el = document.getElementById("detail-chart");
        if (!el) return;

        var p = t.periods && t.periods[period];
        if (!p || !p.t || !p.v || !p.v.length) {
            el.innerHTML = '<div class="ticker-loading"><span>No data for this period</span></div>';
            return;
        }

        el.innerHTML = "";

        var yMin = Math.min.apply(null, p.v);
        var yMax = Math.max.apply(null, p.v);
        var yPad = Math.max((yMax - yMin) * 0.12, yMax * 0.002);

        var up = p.v[p.v.length - 1] >= p.v[0];
        var lineColor = up ? "#00e87b" : "#ff4d4d";
        var fillColor = up ? "rgba(0,232,123,.08)" : "rgba(255,77,77,.08)";

        var baseline = {
            x: p.t,
            y: p.t.map(function () { return yMin - yPad; }),
            type: "scatter", mode: "lines",
            line: { color: "transparent", width: 0 },
            showlegend: false, hoverinfo: "skip"
        };

        var trace = {
            x: p.t, y: p.v,
            type: "scatter", mode: "lines",
            line: { color: lineColor, width: 2 },
            fill: "tonexty", fillcolor: fillColor,
            hovertemplate: "<b>%{x}</b><br>$%{y:,.2f}<extra></extra>"
        };

        var xt = getSparseXTicks(p.t, period);
        var xTickVals = xt.tickvals;
        var xTickText = xt.ticktext;
        var useCustomTicks = xTickVals.length > 0;

        var volArr = p.vol || [];
        var hasVol = volArr.length === p.v.length && volArr.some(function (z) { return z > 0; });

        var axisFont = { family: "JetBrains Mono", size: 10, color: "rgba(255,255,255,.4)" };
        var hoverLbl = {
            bgcolor: "rgba(18,20,42,.92)",
            bordercolor: "rgba(255,255,255,.12)",
            font: { family: "JetBrains Mono", size: 12, color: "rgba(255,255,255,.9)" }
        };

        var traces = [baseline, trace];

        if (hasVol) {
            var volMax = Math.max.apply(null, volArr);
            var barColors = [];
            for (var vi = 0; vi < p.v.length; vi++) {
                var upBar = vi === 0 ? true : p.v[vi] >= p.v[vi - 1];
                barColors.push(upBar ? "rgba(0,232,123,.35)" : "rgba(255,77,77,.35)");
            }

            var traceVol = {
                x: p.t,
                y: volArr,
                type: "bar",
                name: "Volume",
                yaxis: "y2",
                marker: { color: barColors, line: { width: 0 } },
                hovertemplate: "%{y:,.0f}<extra>Vol</extra>"
            };
            traces.push(traceVol);
        }

        var layout = {
            margin: { t: 12, r: 55, b: 40, l: 55 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            xaxis: {
                showgrid: false,
                color: "rgba(255,255,255,.35)",
                tickfont: axisFont,
                tickangle: 0,
                tickvals: useCustomTicks ? xTickVals : undefined,
                ticktext: useCustomTicks ? xTickText : undefined
            },
            yaxis: {
                range: [yMin - yPad, yMax + yPad],
                gridcolor: "rgba(255,255,255,.06)",
                color: "rgba(255,255,255,.35)",
                tickfont: axisFont,
                tickprefix: "$",
                side: "right"
            },
            hovermode: "x unified",
            hoverlabel: hoverLbl,
            showlegend: false,
            font: { family: "JetBrains Mono, monospace", size: 10, color: "rgba(255,255,255,.4)" }
        };

        if (hasVol) {
            layout.yaxis2 = {
                overlaying: "y",
                side: "left",
                range: [0, volMax * 4.5],
                showgrid: false,
                showticklabels: false,
                showline: false,
                zeroline: false
            };
            layout.bargap = period === "1d" ? 0.4 : 0.15;
        }

        Plotly.newPlot(el, traces, layout, { displayModeBar: false, responsive: true });
    }

    function renderChartOrCompare() {
        var el = document.getElementById("detail-chart");
        if (!el) return;
        if (compareMode) {
            var symA = cmpSelectedA;
            var symB = cmpSelectedB;
            if (symA && symB) {
                var ta = allTickers.find(function (x) { return x.symbol === symA; });
                var tb = allTickers.find(function (x) { return x.symbol === symB; });
                if (ta && tb) {
                    renderCompareChart(ta, tb, activePeriod);
                    return;
                }
            }
        }
        if (activeTicker) renderChart(activeTicker, activePeriod);
    }

    function renderCompareChart(ta, tb, period) {
        var el = document.getElementById("detail-chart");
        if (!el) return;
        var pa = ta.periods && ta.periods[period];
        var pb = tb.periods && tb.periods[period];
        if (!pa || !pb || !pa.v || !pb.v || !pa.v.length || !pb.v.length) {
            el.innerHTML = '<div class="ticker-loading"><span>Need overlapping history for this period</span></div>';
            return;
        }
        el.innerHTML = "";
        var n = Math.min(pa.v.length, pb.v.length);
        var va = pa.v.slice(-n);
        var vb = pb.v.slice(-n);
        var x = pa.t.slice(-n);
        var baseA = va[0];
        var baseB = vb[0];
        if (!baseA || !baseB) {
            el.innerHTML = '<div class="ticker-loading"><span>Compare unavailable</span></div>';
            return;
        }
        var ya = va.map(function (v) { return (v / baseA - 1) * 100; });
        var yb = vb.map(function (v) { return (v / baseB - 1) * 100; });

        var traceA = {
            x: x, y: ya, type: "scatter", mode: "lines",
            name: ta.symbol,
            line: { color: "#3b82f6", width: 2 },
            hovertemplate: "<b>" + ta.symbol + "</b><br>%{y:.2f}%<extra></extra>"
        };
        var traceB = {
            x: x, y: yb, type: "scatter", mode: "lines",
            name: tb.symbol,
            line: { color: "#a78bfa", width: 2 },
            hovertemplate: "<b>" + tb.symbol + "</b><br>%{y:.2f}%<extra></extra>"
        };

        var cxt = getSparseXTicks(x, period);
        var useCmpTicks = cxt.tickvals.length > 0;

        var layout = {
            margin: { t: 12, r: 55, b: period === "1mo" || period === "6mo" ? 48 : 44, l: 55 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            xaxis: {
                showgrid: false,
                color: "rgba(255,255,255,.35)",
                tickfont: { family: "JetBrains Mono", size: 10, color: "rgba(255,255,255,.4)" },
                tickangle: 0,
                tickvals: useCmpTicks ? cxt.tickvals : undefined,
                ticktext: useCmpTicks ? cxt.ticktext : undefined
            },
            yaxis: {
                title: "% vs start of period",
                gridcolor: "rgba(255,255,255,.06)",
                color: "rgba(255,255,255,.35)",
                tickfont: { family: "JetBrains Mono", size: 10, color: "rgba(255,255,255,.4)" },
                ticksuffix: "%",
                side: "right"
            },
            hovermode: "x unified",
            legend: {
                orientation: "h",
                yanchor: "bottom",
                y: 1.02,
                x: 0,
                font: { color: "rgba(255,255,255,.8)", size: 11 }
            },
            hoverlabel: {
                bgcolor: "rgba(18,20,42,.92)",
                bordercolor: "rgba(255,255,255,.12)",
                font: { family: "JetBrains Mono", size: 12, color: "rgba(255,255,255,.9)" }
            },
            showlegend: true,
            font: { family: "JetBrains Mono, monospace", size: 10, color: "rgba(255,255,255,.4)" }
        };

        Plotly.newPlot(el, [traceA, traceB], layout, { displayModeBar: false, responsive: true });
    }

    /* ═══════════════════════════════════════════════════════
       DETAIL STATS — 2-column financial table
       ═══════════════════════════════════════════════════════ */
    function renderStats(t) {
        var el = document.getElementById("detail-stats");
        if (!el) return;

        var rows = [
            { l: "Prev Close",  v: fmtPrice(t.prev_close) },
            { l: "Open",        v: fmtPrice(t.open) },
            { l: "Day Range",   v: fmtPrice(t.day_low) + " - " + fmtPrice(t.day_high) },
            { l: "52W Range",   v: t.low52 != null ? fmtPrice(t.low52) + " - " + fmtPrice(t.high52) : "--" },
            { l: "Volume",      v: t.vol || "--" },
            { l: "Avg Volume",  v: t.avg_vol || "--" },
            { l: "Market Cap",  v: t.mkt_cap || "--" },
            { l: "P/E (TTM)",   v: t.pe != null ? t.pe.toFixed(2) : "--" },
            { l: "Forward P/E", v: t.fwd_pe != null ? t.fwd_pe.toFixed(2) : "--" },
            { l: "P/B",         v: t.pb != null ? t.pb.toFixed(2) : "--" },
            { l: "EPS (TTM)",   v: t.eps != null ? t.eps.toFixed(2) : "--" },
            { l: "Beta",        v: t.beta != null ? t.beta.toFixed(2) : "--" },
            { l: "Div Yield",   v: t.div_yield != null ? t.div_yield.toFixed(2) + "%" : "--" },
        ];

        if (rows.length % 2 !== 0) rows.push({ l: "", v: "" });

        var html = "";
        rows.forEach(function (r) {
            html += '<div class="stat-cell"><span class="stat-label">' + r.l + '</span><span class="stat-value">' + r.v + '</span></div>';
        });
        el.innerHTML = html;
    }

    /* ═══════════════════════════════════════════════════════
       PERIOD BUTTONS
       ═══════════════════════════════════════════════════════ */
    function initPeriodButtons() {
        var btns = document.querySelectorAll("#detail-periods .period-btn");
        btns.forEach(function (btn) {
            btn.addEventListener("click", function () {
                if (!activeTicker && !compareMode) return;
                activePeriod = btn.getAttribute("data-p");
                updatePeriodButtons(activePeriod);
                renderChartOrCompare();
            });
        });
    }

    function initCompareControls() {
        initCompareSearch("compare-a", "cmp-dd-a", "cmp-wrap-a", function (s) { cmpSelectedA = s; });
        initCompareSearch("compare-b", "cmp-dd-b", "cmp-wrap-b", function (s) { cmpSelectedB = s; });

        var run = document.getElementById("compare-run");
        var clear = document.getElementById("compare-clear");
        if (run) {
            run.addEventListener("click", function () {
                if (!cmpSelectedA || !cmpSelectedB) return;
                if (cmpSelectedA === cmpSelectedB) return;
                compareMode = true;
                if (activePeriod === "1d") {
                    activePeriod = "5d";
                    updatePeriodButtons("5d");
                }
                renderChartOrCompare();
            });
        }
        if (clear) {
            clear.addEventListener("click", function () {
                compareMode = false;
                cmpSelectedB = "";
                var ib = document.getElementById("compare-b");
                if (ib) { ib.value = ""; ib.classList.remove("cmp-locked"); }
                if (activeTicker) renderChartOrCompare();
            });
        }
    }

    function updatePeriodButtons(period) {
        var btns = document.querySelectorAll("#detail-periods .period-btn");
        btns.forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-p") === period);
        });
    }

    /* ═══════════════════════════════════════════════════════
       BOOT
       ═══════════════════════════════════════════════════════ */
    function bootMarketData(json) {
        allTickers = json.tickers || [];

        var ts = document.getElementById("terminal-ts");
        if (ts && json.updated_at) {
            var d = new Date(json.updated_at);
            ts.textContent = "Updated " + d.toLocaleString("en-US", {
                month: "short", day: "numeric", hour: "2-digit",
                minute: "2-digit", timeZoneName: "short"
            });
        }

        buildTape(allTickers);
        renderMacroStrip(allTickers);
        initGlowCards();
        initSearch();
        initPeriodButtons();
        initCompareControls();

        var defaultSym = json.default || "GOOGL";
        selectTicker(defaultSym);
    }

    function initTerminal() {
        var detail = document.getElementById("detail");
        if (!detail) return;

        if (typeof MARKET_DATA !== "undefined" && MARKET_DATA && MARKET_DATA.tickers) {
            bootMarketData(MARKET_DATA);
            return;
        }

        fetch(DATA_PATH)
            .then(function (r) {
                if (!r.ok) throw new Error(r.status);
                return r.json();
            })
            .then(function (json) { bootMarketData(json); })
            .catch(function (err) {
                console.error("Market data load failed:", err);
                detail.innerHTML = '<div class="ticker-loading"><span>Market data unavailable</span></div>';
            });
    }

    /* ═══════════════════════════════════════════════════════
       TRANSITION PANEL — slide between pillars
       ═══════════════════════════════════════════════════════ */
    function initTransitionPanel() {
        var track = document.getElementById("tp-track");
        var prev = document.getElementById("tp-prev");
        var next = document.getElementById("tp-next");
        var dotsWrap = document.getElementById("tp-dots");
        if (!track || !prev || !next || !dotsWrap) return;

        var dots = dotsWrap.querySelectorAll(".tp-dot");
        var total = track.children.length;
        var idx = 0;

        function go(i) {
            idx = Math.max(0, Math.min(total - 1, i));
            track.style.transform = "translateX(-" + (idx * 100) + "%)";
            prev.disabled = idx === 0;
            next.textContent = idx === total - 1 ? "Close" : "Next";
            dots.forEach(function (d, j) {
                d.classList.toggle("active", j === idx);
            });
        }

        prev.addEventListener("click", function () { go(idx - 1); });
        next.addEventListener("click", function () {
            if (idx < total - 1) go(idx + 1);
        });
        dots.forEach(function (d) {
            d.addEventListener("click", function () {
                go(parseInt(d.getAttribute("data-i")));
            });
        });
    }

    /* ═══════════════════════════════════════════════════════
       GLOWING CARDS — mouse-follow border glow
       ═══════════════════════════════════════════════════════ */
    function initGlowCards() {
        var cards = document.querySelectorAll("[data-glow]");
        cards.forEach(function (card) {
            card.addEventListener("mousemove", function (e) {
                var rect = card.getBoundingClientRect();
                card.style.setProperty("--mx", (e.clientX - rect.left) + "px");
                card.style.setProperty("--my", (e.clientY - rect.top) + "px");
            });
        });
    }

    /* ═══════════════════════════════════════════════════════
       TILT CARD — 3D perspective follow mouse
       ═══════════════════════════════════════════════════════ */
    function initTiltCards() {
        var cards = document.querySelectorAll("[data-tilt]");
        cards.forEach(function (card) {
            card.addEventListener("mousemove", function (e) {
                var rect = card.getBoundingClientRect();
                var x = (e.clientX - rect.left) / rect.width;
                var y = (e.clientY - rect.top) / rect.height;
                var rotY = (x - 0.5) * 16;
                var rotX = (0.5 - y) * 16;
                card.style.transform = "rotateX(" + rotX + "deg) rotateY(" + rotY + "deg) scale3d(1.02,1.02,1.02)";
                card.style.setProperty("--tx", (x * 100) + "%");
                card.style.setProperty("--ty", (y * 100) + "%");
            });
            card.addEventListener("mouseleave", function () {
                card.style.transform = "rotateX(0) rotateY(0) scale3d(1,1,1)";
            });
        });
    }

    /* ═══════════════════════════════════════════════════════
       EASTER EGGS — witty notes on specific tickers
       ═══════════════════════════════════════════════════════ */
    var EASTER_EGGS = {
        "GOOGL": "💡 I set Google as default because DeepMind is the frontier of AI innovation — everyone should be paying attention.",
        "GC=F":  "🏆 If you're looking at gold, you think strategically. I respect that.",
        "NVDA":  "🚀 NVIDIA isn't just a stock — it's the backbone of the AI revolution. Jensen Huang, take a bow.",
        "TSLA":  "⚡ Love it or hate it, Tesla redefined what a car company can be. The data doesn't lie.",
        "AAPL":  "🍎 Apple taught us that design IS the product. As an economist, I study their pricing power religiously.",
        "BVN":   "🇵🇪 Buenaventura — Peru's gold. Supporting local markets is personal for me.",
        "SPY":   "📊 The S&P 500 is the heartbeat of global capitalism. If you understand SPY, you understand markets.",
        "BZ=F":  "🛢️ Brent Crude — the macro variable that moves nations. Every economist's favorite headache.",
        "META":  "🌐 Meta bet everything on the metaverse. Bold moves require bold analysis.",
        "^DJI":  "📈 The Dow Jones — 128 years of market history in one index. Respect the classics."
    };

    function initResearchMarquee() {
        ["ri-track", "ri-track-2"].forEach(function (id) {
            var track = document.getElementById(id);
            if (!track) return;
            var items = track.innerHTML;
            track.innerHTML = items + items;
        });
    }

    /* ── CV Download Dropdown ──────────────────────────── */
    function initCvDropdown() {
        var btn = document.getElementById("cv-download-btn");
        var bubble = document.getElementById("cv-bubble");
        if (!btn || !bubble) return;

        function open() {
            bubble.classList.add("is-open");
            btn.setAttribute("aria-expanded", "true");
        }

        function close() {
            bubble.classList.remove("is-open");
            btn.setAttribute("aria-expanded", "false");
        }

        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            bubble.classList.contains("is-open") ? close() : open();
        });

        document.addEventListener("click", function () {
            close();
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") close();
        });
    }

    /* ── Init ──────────────────────────────────────────── */
    document.addEventListener("DOMContentLoaded", function () {
        initShaderBg();
        initGradient();
        initNav();
        initReveal();
        initTerminal();
        initGlowCards();
        initTiltCards();
        initTransitionPanel();
        initResearchMarquee();
        initCvDropdown();
    });
})();
