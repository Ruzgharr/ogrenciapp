import * as store from '../store.js';
import { dailyGoal } from '../goal.js';
import { todayKey, addDays, formatDayLong } from '../core/dates.js';
import { onDay, totalMinutes, minutesBySubject, questionTotals } from '../core/stats.js';

export async function shareSummaryCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  
  // 1. Zemin Rengi (Ultra Koyu Gece Mavisi)
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, 1080, 1920);
  
  // 2. Mesh Gradient Glow Efektleri
  const glow1 = ctx.createRadialGradient(200, 300, 0, 200, 300, 800);
  glow1.addColorStop(0, 'rgba(56, 189, 248, 0.15)'); // Acik Mavi
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, 1080, 1920);
  
  const glow2 = ctx.createRadialGradient(900, 1300, 0, 900, 1300, 800);
  glow2.addColorStop(0, 'rgba(52, 211, 153, 0.12)'); // Zümrüt Yesili
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, 1080, 1920);

  // Noktali/Grid Doku (Tech Hissi)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let x = 0; x < 1080; x += 40) {
    for (let y = 0; y < 1920; y += 40) {
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Verileri Hazirla
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const todaySessions = onDay(store.sessions(), today);
  const yestSessions = onDay(store.sessions(), yesterday);
  const todayQuestions = onDay(store.questions(), today);
  
  const todayMins = totalMinutes(todaySessions);
  const yestMins = totalMinutes(yestSessions);
  const goal = dailyGoal();
  
  const qTotals = questionTotals(todayQuestions, store.penalty());
  const bySubj = minutesBySubject(todaySessions);
  
  // 3. Baslik ve Tarih (Sade & Zarif)
  ctx.fillStyle = '#38bdf8'; // accent
  ctx.font = '700 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '4px';
  ctx.fillText('YKS ÇALIŞMA ÖZETİ', 540, 180);
  
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '500 34px sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText(formatDayLong(today), 540, 240);
  
  // 4. Ana Hedef Halkasi (Ortada, Neon Efektli)
  const ringY = 580;
  
  if (goal > 0) {
    const progress = Math.min(1, todayMins / goal);
    const ringColor = progress >= 1 ? '#34d399' : '#38bdf8';
    
    // Dis Glow
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = 60;
    drawRing(ctx, 540, ringY, 220, progress, ringColor, 24);
    ctx.shadowBlur = 0; // Sifirla
  } else {
    drawRing(ctx, 540, ringY, 220, 0, '#38bdf8', 24);
  }
  
  // Halka Ici Yazi (Toplam Sure)
  ctx.fillStyle = '#ffffff';
  const hrs = Math.floor(todayMins / 60);
  const mins = todayMins % 60;
  
  if (hrs > 0) {
    ctx.font = '800 110px sans-serif';
    ctx.fillText(`${hrs}`, 460, ringY - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 48px sans-serif';
    ctx.fillText('sa', 525, ringY - 10);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 110px sans-serif';
    ctx.fillText(`${mins}`, 540, ringY + 90);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 48px sans-serif';
    ctx.fillText('dk', 635, ringY + 90);
  } else {
    ctx.font = '800 140px sans-serif';
    ctx.fillText(`${mins}`, 510, ringY + 40);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 54px sans-serif';
    ctx.fillText('dk', 660, ringY + 40);
  }
  
  // 5. Dün İle Karşılaştırma Hap (Pill)
  let compText = '';
  let compColor = '';
  let compBg = '';
  if (yestMins > 0) {
    const diff = todayMins - yestMins;
    if (diff > 0) {
      compText = `▲ Düne göre ${diff} dk artış`;
      compColor = '#34d399';
      compBg = 'rgba(52, 211, 153, 0.15)';
    } else if (diff < 0) {
      compText = `▼ Düne göre ${-diff} dk azalış`;
      compColor = '#f87171';
      compBg = 'rgba(248, 113, 113, 0.15)';
    } else {
      compText = 'Dün ile aynı süre';
      compColor = '#94a3b8';
      compBg = 'rgba(148, 163, 184, 0.15)';
    }
  } else {
    compText = '✦ Harika bir başlangıç!';
    compColor = '#38bdf8';
    compBg = 'rgba(56, 189, 248, 0.15)';
  }
  
  ctx.fillStyle = compBg;
  ctx.beginPath(); ctx.roundRect(540 - 240, ringY + 300, 480, 72, 36); ctx.fill();
  ctx.fillStyle = compColor;
  ctx.font = '600 32px sans-serif';
  ctx.fillText(compText, 540, ringY + 348);
  
  // 6. Soru ve Net (Premium Cam Kartlar)
  drawGlassCard(ctx, 100, ringY + 440, 410, 220);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 84px sans-serif';
  ctx.fillText(qTotals.total.toString(), 305, ringY + 560);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '600 28px sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('ÇÖZÜLEN SORU', 305, ringY + 610);
  ctx.letterSpacing = '0px';
  
  drawGlassCard(ctx, 570, ringY + 440, 410, 220);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 84px sans-serif';
  ctx.fillText(qTotals.net.toFixed(1), 775, ringY + 560);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '600 28px sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('TOPLAM NET', 775, ringY + 610);
  ctx.letterSpacing = '0px';
  
  // 7. Ders Dağılımı Tablosu (Neon Barlar)
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '600 36px sans-serif';
  ctx.fillText('Derslere Göre Dağılım', 100, ringY + 740);
  
  let startY = ringY + 780;
  if (bySubj.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 32px sans-serif';
    ctx.fillText('Bugün ders kaydı yok.', 100, startY + 40);
  } else {
    for (let i = 0; i < bySubj.length && i < 4; i++) { // Max 4 row
      const row = bySubj[i];
      const name = store.subjectName(row.subjectId);
      const color = store.subjectColor(row.subjectId) || '#38bdf8';
      
      // Zemin
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.roundRect(100, startY, 880, 80, 24); ctx.fill();
      
      // Ilerleme
      const ratio = todayMins > 0 ? (row.minutes / todayMins) : 0;
      ctx.fillStyle = color;
      
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.roundRect(100, startY, Math.max(32, 880 * ratio), 80, 24); ctx.fill();
      ctx.shadowBlur = 0;
      
      // Icerik (Ilerleme uzerinde kontrast veya sagda)
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 34px sans-serif';
      // Ders adi her zaman beyaz kalabilir bar karanlik
      ctx.fillText(name, 130, startY + 54);
      
      ctx.textAlign = 'right';
      const rHrs = Math.floor(row.minutes / 60);
      const rMins = row.minutes % 60;
      const rTimeStr = rHrs > 0 ? `${rHrs}sa ${rMins}dk` : `${rMins} dk`;
      
      const subQs = todayQuestions.filter(q => q.subjectId === row.subjectId);
      const subTotals = questionTotals(subQs, store.penalty());
      let statText = rTimeStr;
      if (subTotals.total > 0) statText += ` • ${subTotals.total} Soru`;
      
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(statText, 950, startY + 54);
      ctx.textAlign = 'left';
      
      startY += 100;
    }
  }
  
  // 8. Footer Logo
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '600 28px sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText('YKS ÇALIŞMA ODASI', 540, 1860);
  
  try {
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Canvas export error:', e);
    return null;
  }
}

function drawGlassCard(ctx, x, y, w, h) {
  // Arkaplan (saydam)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 40); ctx.fill();
  
  // Cerceve (parlak gradient)
  const border = ctx.createLinearGradient(x, y, x+w, y+h);
  border.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
  border.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawRing(ctx, x, y, r, progress, color, width) {
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  
  // Track
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  
  // Fill
  if (progress > 0) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
    ctx.stroke();
  }
}
