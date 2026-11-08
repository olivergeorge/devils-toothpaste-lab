import {
  CapturedPhoto,
  ExperimentConfig,
  ReactionSimulationResult,
  SafetyGearState,
  ScienceReport,
} from '../types/chemistry';
import {
  DYE_COLORS,
  INGREDIENT_META,
  SCALE_ENVIRONMENTS,
  evaluateExperimentMishaps,
  evaluateSafetyHazards,
} from './chemistryEngine';

export function generateDraftScienceReport(
  config: ExperimentConfig,
  safetyGear: SafetyGearState,
  telemetry: ReactionSimulationResult,
  photos: CapturedPhoto[],
  existingScientistName = 'Lead Field Researcher'
): ScienceReport {
  const scale = SCALE_ENVIRONMENTS[config.scaleId];
  const catalystName =
    config.catalystType === 'potassium_iodide'
      ? 'Potassium Iodide (KI)'
      : 'Warm Active Dry Yeast (Catalase)';
  const dyeName = DYE_COLORS[config.dyeColor].label;
  const safety = evaluateSafetyHazards(config, safetyGear);
  const mishaps = evaluateExperimentMishaps(config, safetyGear, telemetry);

  const hasPeroxide = config.additionOrder.includes('peroxide') && config.peroxideVolumePercent > 0;
  const hasSoap = config.additionOrder.includes('soap') && config.soapVolumeMlPerLiter > 0;
  const hasCatalyst = config.additionOrder.includes('catalyst') && config.catalystRatio > 0;
  const hasOrbeez = config.additionOrder.includes('orbeez') && (config.orbeezCount || 0) > 0;

  const activeLiters = hasPeroxide
    ? ((scale.vesselCapacityLiters * config.peroxideVolumePercent) / 100).toFixed(1)
    : '0.0';

  const aim = `To test how measuring ${activeLiters} L of ${config.peroxideConcentration}% Hydrogen Peroxide (H₂O₂), ${
    hasSoap ? `${config.soapVolumeMlPerLiter} mL/L of Dish Soap` : '0 mL/L Dish Soap'
  }, and ${hasCatalyst ? `${config.catalystRatio}% ${catalystName}` : 'no Catalyst'} inside a ${
    scale.vesselCapacityLiters
  }L ${scale.name} changes the Elephant’s Toothpaste eruption.`;

  const hypothesis =
    config.additionOrder.indexOf('catalyst') !== -1 &&
    config.additionOrder.indexOf('soap') !== -1 &&
    config.additionOrder.indexOf('catalyst') < config.additionOrder.indexOf('soap')
      ? `Because Catalyst (${catalystName}) was dragged & dropped BEFORE Dish Soap, we predict the oxygen gas (O₂) will boil away as fizz before soap bubbles can trap it.`
      : config.peroxideConcentration >= 35 && config.soapVolumeMlPerLiter < 28 && hasSoap
      ? `At ${config.peroxideConcentration}% H₂O₂ with only ${config.soapVolumeMlPerLiter} mL/L of Dish Soap, the >100°C exothermic heat will flash-vaporize water into a steam geyser.`
      : config.soapVolumeMlPerLiter >= 75 && hasSoap
      ? `Because we squirted a huge overdose of Dish Soap (${config.soapVolumeMlPerLiter} mL/L), the heavy surfactant will weigh down the foam into slow-oozing lava sludge.`
      : `Mixing ${activeLiters} L of ${config.peroxideConcentration}% H₂O₂ with ${config.soapVolumeMlPerLiter} mL/L Dish Soap and ${catalystName} will trap O₂ gas bubbles and launch foam ~${telemetry.peakHeightMeters} meters high.`;

  const soapStatusLabel = !hasSoap
    ? '0 mL/L (FORGOT DISH SOAP!)'
    : config.soapVolumeMlPerLiter < 28
    ? `${config.soapVolumeMlPerLiter} mL/L (Too Little — Steam Risk!)`
    : config.soapVolumeMlPerLiter >= 75
    ? `${config.soapVolumeMlPerLiter} mL/L (Soap Overdose — Heavy Sludge!)`
    : `${config.soapVolumeMlPerLiter} mL/L (Sweet Spot Golden Ratio!)`;

  const actualAmountsMeasured = [
    `Hydrogen Peroxide Fuel: ${
      hasPeroxide
        ? `${activeLiters} L (${config.peroxideVolumePercent}% of ${scale.vesselCapacityLiters}L container) at ${config.peroxideConcentration}% strength${
            config.peroxideVolumePercent > 100 ? ' [OVERFLOWING RIM!]' : ''
          }`
        : '0 L — FORGOT TO POUR PEROXIDE!'
    }`,
    `Dish Soap Surfactant: ${soapStatusLabel} + ${dyeName} dye`,
    `Catalyst Spark: ${
      hasCatalyst
        ? `${config.catalystRatio}% load of ${catalystName}`
        : '0% — FORGOT TO DROP CATALYST!'
    }`,
    `Orbeez Water Beads: ${
      hasOrbeez ? `${(config.orbeezCount || 2500).toLocaleString()} hydrated beads` : '0 beads (None added)'
    }`,
  ];

  const equipmentList = [
    `${scale.name} (${scale.vesselCapacityLiters} L capacity)`,
    ...actualAmountsMeasured,
  ];

  const equippedPpe: string[] = [];
  if (safetyGear.goggles) equippedPpe.push('Splash Goggles ✓');
  else equippedPpe.push('NO GOGGLES (Soap-in-Eye Risk!)');
  if (safetyGear.gloves) equippedPpe.push('Nitrile Gloves ✓');
  else equippedPpe.push('BARE HANDS (No Gloves!)');
  if (safetyGear.hazmatSuit) equippedPpe.push('Thermal Hazmat Suit ✓');
  if (safetyGear.remoteTriggerArmed) equippedPpe.push('Remote Trigger ✓');
  equippedPpe.push(`${safetyGear.standBackMeters}m Standoff Distance`);

  const safetyNotes = `Risk Level: ${safety.riskLevel} (${safety.riskScore}/100). Safety Gear Status: ${equippedPpe.join(
    ', '
  )}. ${safety.chemicalEducationNote}`;

  const methodSteps =
    config.pouredLog && config.pouredLog.length > 0
      ? config.pouredLog.map(
          (entry, idx) => `Step ${idx + 1}: Measured & poured ${entry.amountLabel}.`
        )
      : config.additionOrder.map((step, idx) => {
          const meta = INGREDIENT_META[step];
          if (step === 'peroxide') {
            return `Step ${idx + 1}: Measured and poured ${activeLiters} L of ${config.peroxideConcentration}% Hydrogen Peroxide (${meta.formula}) into the ${scale.name}.`;
          }
          if (step === 'soap') {
            return `Step ${idx + 1}: Squirted ${config.soapVolumeMlPerLiter} mL/L of Dish Soap surfactant and ${dyeName} dye.`;
          }
          if (step === 'orbeez') {
            return `Step ${idx + 1}: Dumped ${(config.orbeezCount || 2500).toLocaleString()} hydrated Orbeez water beads into the container.`;
          }
          return `Step ${idx + 1}: Dropped ${config.catalystRatio}% ${catalystName} to trigger the reaction.`;
        });

  if (methodSteps.length === 0) {
    methodSteps.push(
      'Step 1: Scientist pressed SEND IT without dragging or pouring any ingredients into the container!'
    );
  }

  const bloopersAndMishaps = mishaps.map((m) => m.reportBlooperLine);

  const whatReallyHappened = `${telemetry.outcomeTitle}! The reaction reached ${
    telemetry.peakHeightMeters
  } m high (${telemetry.foamVolumeCubicMeters} m³ of foam) at ${telemetry.peakTempCelsius}°C. ${
    telemetry.outcomeSummary
  }${
    bloopersAndMishaps.length > 0
      ? ` Lab Bloopers: ${bloopersAndMishaps.join(' ')}`
      : ' Zero safety bloopers—full PPE worn like a pro!'
  }`;

  const resultsSummary = `${telemetry.outcomeTitle} — Peak Plume Height: ${
    telemetry.peakHeightMeters
  } m | Foam Volume: ${telemetry.foamVolumeCubicMeters} m³ | Peak Exothermic Temp: ${
    telemetry.peakTempCelsius
  }°C | O₂ Gas Evolved: ${telemetry.oxygenGasLiters.toLocaleString()} L | Exit Velocity: ${
    telemetry.eruptionVelocityMps
  } m/s | Gas Trapping Efficiency: ${Math.round(telemetry.foamTrapEfficiency * 100)}%.`;

  const conclusion = `${whatReallyHappened} ${telemetry.chemistryExplanation}`;

  return {
    id: `rep_${Date.now()}`,
    title: `${scale.name}: ${config.peroxideConcentration}% H₂O₂ (${activeLiters}L) — ${telemetry.outcomeTitle}`,
    scientistName: existingScientistName,
    createdAt: new Date().toLocaleString(),
    aim,
    hypothesis,
    actualAmountsMeasured,
    equipmentList,
    safetyNotes,
    methodSteps,
    whatReallyHappened,
    bloopersAndMishaps,
    resultsSummary,
    conclusion,
    config: {
      ...config,
      additionOrder: [...config.additionOrder],
      pouredLog: config.pouredLog ? [...config.pouredLog] : [],
    },
    safetyGear: { ...safetyGear },
    telemetry: { ...telemetry },
    photos: [...photos],
  };
}

export function formatReportAsMarkdown(report: ScienceReport): string {
  return [
    `# SCIENCE LAB REPORT: ${report.title}`,
    `**Researcher:** ${report.scientistName} | **Date:** ${report.createdAt}`,
    ``,
    `## 1. Aim & Hypothesis`,
    `- **Aim:** ${report.aim}`,
    `- **Hypothesis:** ${report.hypothesis}`,
    ``,
    `## 2. Actual Amounts Measured & Safety Gear`,
    ...(report.actualAmountsMeasured || report.equipmentList).map((item) => `- ${item}`),
    `- **Safety Status:** ${report.safetyNotes}`,
    ``,
    `## 3. Experimental Method (What I Actually Poured In Order)`,
    ...report.methodSteps.map((step) => `- ${step}`),
    ``,
    `## 4. What Really Happened & Lab Bloopers`,
    `- **What Really Happened:** ${report.whatReallyHappened || report.resultsSummary}`,
    ...(report.bloopersAndMishaps && report.bloopersAndMishaps.length > 0
      ? report.bloopersAndMishaps.map((b) => `- **Funny Lab Blooper:** ${b}`)
      : [`- **Safety Record:** Zero mishaps!`]),
    ``,
    `## 5. Quantitative Results & Telemetry`,
    `- **Outcome:** ${report.telemetry.outcomeTitle}`,
    `- **Peak Plume Height:** ${report.telemetry.peakHeightMeters} m`,
    `- **Total Foam Volume:** ${report.telemetry.foamVolumeCubicMeters} m³`,
    `- **Peak Exothermic Temperature:** ${report.telemetry.peakTempCelsius} °C`,
    `- **Oxygen Gas Evolved:** ${report.telemetry.oxygenGasLiters.toLocaleString()} L`,
    `- **Nozzle Eruption Velocity:** ${report.telemetry.eruptionVelocityMps} m/s`,
    `- **Surfactant Trap Efficiency:** ${Math.round(report.telemetry.foamTrapEfficiency * 100)}%`,
    ``,
    `## 6. Chemical Discussion & Conclusion`,
    `${report.conclusion}`,
    ``,
    `---`,
    `*Generated in Elephant's Toothpaste 3D Lab — Exothermic Foam Physics Sandbox*`,
  ].join('\n');
}

// Renders a downloadable high-resolution PNG Science Report Poster including captured 3D WebGL photos
export async function exportReportAsPngCard(report: ScienceReport): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 1020;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 1400, 1020);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(1, '#111827');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1400, 1020);

  // Subtle technical grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1400; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1020);
    ctx.stroke();
  }
  for (let y = 0; y < 1020; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1400, y);
    ctx.stroke();
  }

  // Top Header Bar
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(40, 36, 1320, 96);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 36, 1320, 96);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 14px "IBM Plex Mono", monospace';
  ctx.fillText('ELEPHANT’S TOOTHPASTE 3D LAB // EXOTHERMIC SCIENCE REPORT', 64, 68);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 28px "Outfit", sans-serif';
  ctx.fillText(report.title.slice(0, 68), 64, 106);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px "DM Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Researcher: ${report.scientistName}  ·  ${report.createdAt}`, 1336, 68);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px "IBM Plex Mono", monospace';
  ctx.fillText(
    `2 H₂O₂ (aq)  →  2 H₂O (l) + O₂ (g) + Heat (-98.2 kJ/mol)`,
    1336,
    106
  );
  ctx.textAlign = 'left';

  // Helper for wrapped text
  const drawWrappedText = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines = 5
  ): number => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    let linesCount = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
        linesCount++;
        if (linesCount >= maxLines - 1) {
          // Last allowed line
        }
      } else {
        line = testLine;
      }
    }
    if (linesCount < maxLines && line.trim()) {
      ctx.fillText(line.trim(), x, currentY);
      currentY += lineHeight;
    }
    return currentY;
  };

  // Left Column (Aim, Equipment, Method, Conclusion) - width 780
  let leftY = 164;

  // Box 1: AIM & HYPOTHESIS
  ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
  ctx.fillRect(40, leftY, 780, 175);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(40, leftY, 780, 175);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 13px "IBM Plex Mono", monospace';
  ctx.fillText('01. AIM & HYPOTHESIS', 60, leftY + 28);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px "DM Sans", sans-serif';
  let nextY = drawWrappedText(`Aim: ${report.aim}`, 60, leftY + 52, 740, 20, 3);
  ctx.fillStyle = '#cbd5e1';
  drawWrappedText(`Hypothesis: ${report.hypothesis}`, 60, nextY + 8, 740, 20, 3);

  leftY += 195;

  // Box 2: EQUIPMENT & SAFETY PPE
  ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
  ctx.fillRect(40, leftY, 780, 195);
  ctx.strokeRect(40, leftY, 780, 195);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px "IBM Plex Mono", monospace';
  ctx.fillText('02. EQUIPMENT, REAGENTS & VR SAFETY GEAR', 60, leftY + 28);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px "DM Sans", sans-serif';
  let eqY = leftY + 52;
  report.equipmentList.slice(0, 4).forEach((item) => {
    ctx.fillText(`• ${item.slice(0, 95)}`, 60, eqY);
    eqY += 22;
  });
  ctx.fillStyle = '#fbbf24';
  drawWrappedText(`Safety: ${report.safetyNotes}`, 60, eqY + 4, 740, 19, 2);

  leftY += 215;

  // Box 3: EXPERIMENTAL METHOD (ORDER OF ADDITION)
  ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
  ctx.fillRect(40, leftY, 780, 185);
  ctx.strokeRect(40, leftY, 780, 185);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 13px "IBM Plex Mono", monospace';
  ctx.fillText('03. METHOD (CHRONOLOGICAL INGREDIENT SEQUENCE)', 60, leftY + 28);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px "DM Sans", sans-serif';
  let mY = leftY + 52;
  report.methodSteps.slice(0, 4).forEach((step) => {
    mY = drawWrappedText(step, 60, mY, 740, 19, 2) + 4;
  });

  leftY += 205;

  // Box 4: DISCUSSION & CONCLUSION
  ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
  ctx.fillRect(40, leftY, 780, 195);
  ctx.strokeRect(40, leftY, 780, 195);

  ctx.fillStyle = '#c084fc';
  ctx.font = 'bold 13px "IBM Plex Mono", monospace';
  ctx.fillText('04. RESULTS ANALYSIS & CONCLUSION', 60, leftY + 28);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 15px "DM Sans", sans-serif';
  ctx.fillText(report.telemetry.outcomeTitle, 60, leftY + 54);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px "DM Sans", sans-serif';
  drawWrappedText(report.conclusion, 60, leftY + 80, 740, 21, 5);

  // Right Column (Telemetry Metrics + Captured 3D Photo) - X: 840, Width: 520
  const rightX = 840;
  let rightY = 164;

  // Telemetry KPI Box
  ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
  ctx.fillRect(rightX, rightY, 520, 260);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.strokeRect(rightX, rightY, 520, 260);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px "IBM Plex Mono", monospace';
  ctx.fillText('QUANTITATIVE REACTION TELEMETRY', rightX + 24, rightY + 28);

  const metrics = [
    { label: 'PEAK PLUME HEIGHT', value: `${report.telemetry.peakHeightMeters} m`, color: '#f59e0b' },
    { label: 'FOAM VOLUME', value: `${report.telemetry.foamVolumeCubicMeters} m³`, color: '#38bdf8' },
    { label: 'EXOTHERMIC PEAK TEMP', value: `${report.telemetry.peakTempCelsius} °C`, color: '#f43f5e' },
    { label: 'O₂ GAS EVOLVED', value: `${report.telemetry.oxygenGasLiters.toLocaleString()} L`, color: '#34d399' },
    { label: 'NOZZLE EXIT VELOCITY', value: `${report.telemetry.eruptionVelocityMps} m/s`, color: '#c084fc' },
    {
      label: 'FOAM TRAP EFFICIENCY',
      value: `${Math.round(report.telemetry.foamTrapEfficiency * 100)}%`,
      color: '#e2e8f0',
    },
  ];

  metrics.forEach((m, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const mx = rightX + 24 + col * 245;
    const my = rightY + 62 + row * 66;

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(m.label, mx, my);

    ctx.fillStyle = m.color;
    ctx.font = 'bold 24px "IBM Plex Mono", monospace';
    ctx.fillText(m.value, mx, my + 28);
  });

  rightY += 280;

  // Photo Frame Box
  ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
  ctx.fillRect(rightX, rightY, 520, 520);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.strokeRect(rightX, rightY, 520, 520);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 13px "IBM Plex Mono", monospace';
  ctx.fillText('CAPTURED 3D EXPERIMENT PHOTOGRAPH', rightX + 24, rightY + 28);

  if (report.photos.length > 0) {
    const primaryPhoto = report.photos[0];
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = primaryPhoto.dataUrl;
      });
      ctx.drawImage(img, rightX + 20, rightY + 44, 480, 420);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px "DM Sans", sans-serif';
      ctx.fillText(
        `${primaryPhoto.caption} (${primaryPhoto.timestamp})`,
        rightX + 24,
        rightY + 492
      );
    } catch {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px "DM Sans", sans-serif';
      ctx.fillText('3D Viewport Snapshot Attached', rightX + 160, rightY + 260);
    }
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(rightX + 20, rightY + 44, 480, 420);
    ctx.fillStyle = '#64748b';
    ctx.font = '14px "DM Sans", sans-serif';
    ctx.fillText('No snapshot captured yet — click "Snap 3D Photo"', rightX + 105, rightY + 255);
  }

  return canvas.toDataURL('image/png');
}
