// CONFIGURATION
const GITHUB_PAGES_URL = "https://cagatay-a.github.io/TrueSignals/api-data.json";
const REFRESH_INTERVAL = 30000; // 30 seconds
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 dakika

// DOM Elements
let emirListesi = [];
let isInitialLoad = true;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('[INIT] TrueSignal Emir Takip Sistemi yüklendi');
    console.log('[CONFIG] SADECE GitHub Pages URL:', GITHUB_PAGES_URL);
    
    // Önce cache'den yükle
    const cacheLoaded = loadFromCache();
    
    // Hemen API'den yükle
    setTimeout(() => {
        loadDataFromGitHub();
        isInitialLoad = false;
    }, cacheLoaded ? 1000 : 0);
    
    // Auto refresh
    setInterval(loadDataFromGitHub, REFRESH_INTERVAL);
    
    // Event listeners
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('[REFRESH] Manuel yenileme başlatıldı');
            
            // Button animation
            const originalHTML = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yenileniyor...';
            this.disabled = true;
            
            loadDataFromGitHub().finally(() => {
                setTimeout(() => {
                    this.innerHTML = originalHTML;
                    this.disabled = false;
                }, 1000);
            });
        });
    }
    
    // Page visibility
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && !isInitialLoad) {
            console.log('[VISIBILITY] Sayfa tekrar görünür oldu, veriler yenileniyor...');
            loadDataFromGitHub();
        }
    });
}

// SADECE GİTHUB PAGES KULLANAN FETCH
async function loadDataFromGitHub() {
    try {
        showLoading(true);
        
        // Cache bypass için timestamp
        const cacheBuster = '?t=' + Date.now();
        console.log('[FETCH] SADECE GitHub Pages:', GITHUB_PAGES_URL + cacheBuster);
        
        const response = await fetch(GITHUB_PAGES_URL + cacheBuster, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`GitHub Pages HTTP hatası: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[FETCH SUCCESS] GitHub Pages verisi alındı:', {
            success: data.success,
            hasEmirler: !!data.emirler,
            message: data.message || 'Veri var'
        });
        
        // Veriyi işle ve cache'e kaydet
        processDataSimple(data);
        
    } catch (error) {
        console.error('[FETCH ERROR] GitHub Pages:', error.message);
        
        // Cache'den yükle
        if (!loadFromCache()) {
            showError("GitHub Pages verisi şu anda yüklenemiyor. Lütfen sayfayı yenileyin (Ctrl+F5).");
        }
    } finally {
        showLoading(false);
    }
}

// BASİT VERİ İŞLEME
function processDataSimple(data) {
    console.log('[PROCESS] Veri işleniyor...');
    console.log('[PROCESS DEBUG] Tam veri yapısı:', data);
    
    let processedData = [];
    let success = false;
    let timestamp = new Date().toISOString();
    let source = 'github-pages';
    
    // VERİ YAPISI ANALİZİ
    if (data.success === true) {
        success = true;
        timestamp = data.lastFetch || timestamp;
        source = data.source || source;
        
        console.log('[PROCESS] Data.emirler tipi:', typeof data.emirler);
        
        // DURUM 1: İç içe yapı {emirler: {emirler: [...], success: true}}
        if (data.emirler && data.emirler.emirler && Array.isArray(data.emirler.emirler)) {
            processedData = data.emirler.emirler;
            console.log(`[PROCESS] Durum 1 - İç içe yapı: ${processedData.length} emir`);
        }
        // DURUM 2: Düz yapı {emirler: [...], success: true}
        else if (data.emirler && Array.isArray(data.emirler)) {
            processedData = data.emirler;
            console.log(`[PROCESS] Durum 2 - Düz dizi: ${processedData.length} emir`);
        }
    } 
    // DURUM 3: Başlangıç şablonu (boş)
    else if (data.success === false) {
        console.log('[PROCESS] Durum 3 - Başlangıç şablonu:', data.message);
        success = false;
        timestamp = data.lastFetch || timestamp;
        source = data.source || source;
        processedData = [];
    }
    
    // DEBUG: İlk emiri göster
    if (processedData.length > 0) {
        console.log('[PROCESS DEBUG] İlk emir:', {
            Sembol: processedData[0].Sembol,
            Tip: processedData[0].Tip,
            Status: processedData[0].Status,
            KarZarar: processedData[0].KarZarar
        });
    }
    
    // Veriyi cache'e kaydet (sadece başarılıysa)
    if (success && processedData.length > 0) {
        cacheData(processedData);
    }
    
    // Update global list
    emirListesi = processedData;
    
    // Update UI
    updateTable();
    updateStats();
    updateLastUpdate(timestamp, source, success);
    updateSystemStatus();
    
    console.log(`[PROCESS SONUÇ] ${processedData.length} emir işlendi, Başarı: ${success}`);
    
    // Bildirim
    if (processedData.length > 0) {
        showNotification(`${processedData.length} emir başarıyla yüklendi!`, 'success');
    } else if (!success) {
        showNotification('GitHub Actions henüz çalışmadı. Lütfen bekleyin...', 'warning');
    }
}

// Türkçe karakter düzeltme
function fixTurkishEncoding(text) {
    if (typeof text !== 'string') return text;
    
    const replacements = {
        'Ä±': 'ı', 'ÄŸ': 'ğ', 'ÅŸ': 'ş', 'Ã§': 'ç', 'Ã¶': 'ö', 'Ã¼': 'ü',
        'Ä°': 'İ', 'Åž': 'Ş', 'Ã‡': 'Ç', 'Ã–': 'Ö', 'Ãœ': 'Ü',
        'KapalÄ±': 'Kapalı', 'UlaÅŸÄ±ldÄ±': 'Ulaşıldı'
    };
    
    let fixedText = text;
    for (const [wrong, correct] of Object.entries(replacements)) {
        fixedText = fixedText.replace(new RegExp(wrong, 'g'), correct);
    }
    
    return fixedText;
}

// Türkçe karakter düzeltme (object için)
function fixTurkishEncodingInObject(obj) {
    if (typeof obj === 'string') {
        return fixTurkishEncoding(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(item => fixTurkishEncodingInObject(item));
    } else if (typeof obj === 'object' && obj !== null) {
        const fixedObj = {};
        for (const [key, value] of Object.entries(obj)) {
            fixedObj[key] = fixTurkishEncodingInObject(value);
        }
        return fixedObj;
    }
    return obj;
}

// Tablo güncelleme
function updateTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) {
        console.error('[TABLE] tableBody bulunamadı!');
        return;
    }
    
    if (emirListesi.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" style="text-align: center; padding: 50px;">
                    <i class="fas fa-database fa-3x mb-3" style="color: #cbd5e0;"></i>
                    <h4>Henüz emir bulunmamaktadır</h4>
                    <p>GitHub Actions'in veri çekmesini bekleyin veya manuel yenileyin.</p>
                    <button class="btn btn-primary mt-3" onclick="loadDataFromGitHub()">
                        <i class="fas fa-sync-alt"></i> Yenile
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    emirListesi.forEach((emir, index) => {
        // Türkçe karakter düzeltme
        const fixedEmir = fixTurkishEncodingInObject(emir);
        
        const sembol = fixedEmir.Sembol || 'N/A';
        const tip = fixedEmir.Tip || 'N/A';
        const durum = fixedEmir.Status || 'N/A';
        const lot = fixedEmir.Lot || '0';
        const giris = fixedEmir.GirisFiyati || '0';
        const stopLoss = fixedEmir.StopLoss;
        const takeProfit = fixedEmir.TakeProfit;
        const kapanis = fixedEmir.KapanisFiyati || '0';
        const karZarar = parseFloat(fixedEmir.KarZarar) || 0;
        const karZararYuzde = parseFloat(fixedEmir.KarZararYuzde) || 0;
        const tarih = fixedEmir.FormatliEmirZamani || fixedEmir.EmirZamani || 'N/A';
        const comment = fixedEmir.Comment || '-';
        
        // Durum badge
        let statusBadge = '';
        const durumLower = durum.toLowerCase();
        if (durumLower.includes('açık') || durumLower.includes('open')) {
            statusBadge = `<span class="status-badge status-open">${durum}</span>`;
        } else if (durumLower.includes('kapalı') || durumLower.includes('closed')) {
            statusBadge = `<span class="status-badge status-closed">${durum}</span>`;
        } else {
            statusBadge = `<span class="status-badge">${durum}</span>`;
        }
        
        // Kar/Zarar renk sınıfı
        const karZararClass = karZarar >= 0 ? 'positive' : 'negative';
        const karZararText = karZarar >= 0 ? `+${formatNumber(karZarar, 2)}` : formatNumber(karZarar, 2);
        const karZararYuzdeText = karZararYuzde >= 0 ? `+${formatNumber(karZararYuzde, 2)}%` : `${formatNumber(karZararYuzde, 2)}%`;
        
        // Emir tipi renk
        const tipClass = tip.toLowerCase().includes('al') ? 'positive' : 'negative';
        
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${formatDateTime(tarih)}</td>
                <td><strong>${sembol}</strong></td>
                <td><span class="${tipClass}">${tip}</span></td>
                <td>${formatNumber(lot)}</td>
                <td>${formatNumber(giris, 4)}</td>
                <td>${stopLoss ? formatNumber(stopLoss, 4) : '-'}</td>
                <td>${takeProfit ? formatNumber(takeProfit, 4) : '-'}</td>
                <td>${formatNumber(kapanis, 4)}</td>
                <td>${statusBadge}</td>
                <td>${comment}</td>
                <td class="${karZararClass}">
                    ${karZararText}<br>
                    <small>${karZararYuzdeText}</small>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="viewDetails(${index})" title="Detaylar">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    console.log(`[TABLE] ${emirListesi.length} satır güncellendi`);
    
    // Tabloyu göster
    showTable();
}

// Tabloyu göster
function showTable() {
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('errorMessage');
    const table = document.getElementById('emirlerTable');
    
    if (loading) loading.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'none';
    if (table) table.style.display = 'table';
}

// İstatistik güncelleme
function updateStats() {
    const total = emirListesi.length;
    const open = emirListesi.filter(e => {
        const durum = (e.Status || '').toLowerCase();
        return durum.includes('açık') || durum.includes('open');
    }).length;
    const closed = total - open;
    const totalProfit = emirListesi.reduce((sum, emir) => sum + (parseFloat(emir.KarZarar) || 0), 0);
    
    // Elementleri güncelle
    const elements = {
        'toplamEmir': total,
        'acikEmirler': open,
        'kapaliEmirler': closed,
        'toplamKarZarar': `${formatNumber(totalProfit, 2)}`
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            if (id === 'toplamKarZarar') {
                element.className = totalProfit >= 0 ? 'positive' : 'negative';
            }
        }
    });
    
    // Sayfa başlığını güncelle
    document.title = total > 0 ? `(${total}) TrueSignal - Emir Takip` : 'TrueSignal - Emir Takip';
}

// Son güncelleme zamanı
function updateLastUpdate(timestamp, source, success) {
    const element = document.getElementById('lastUpdate');
    if (!element) return;
    
    try {
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString('tr-TR');
        const dateStr = date.toLocaleDateString('tr-TR');
        
        let sourceText = source.includes('192.168.1.3') ? 'Local API' : 'GitHub Pages';
        
        element.innerHTML = `
            <i class="fas ${success ? 'fa-check-circle success' : 'fa-exclamation-triangle warning'}"></i>
            <span>Son güncelleme: ${timeStr} (${dateStr})</span>
            <small class="text-muted">Kaynak: ${sourceText}</small>
        `;
    } catch (error) {
        element.innerHTML = `
            <i class="fas fa-clock"></i>
            <span>Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}</span>
        `;
    }
}

// Sistem durumu
function updateSystemStatus() {
    const element = document.getElementById('systemStatus');
    if (!element) return;
    
    let status = 'normal';
    let message = 'Sistem normal çalışıyor';
    let icon = 'fa-check-circle';
    
    if (emirListesi.length === 0) {
        status = 'warning';
        message = 'Emir verisi bulunamadı';
        icon = 'fa-exclamation-triangle';
    } else if (emirListesi.length > 0) {
        status = 'success';
        message = `${emirListesi.length} emir yüklendi`;
        icon = 'fa-check-circle';
    }
    
    element.innerHTML = `
        <i class="fas ${icon} ${status}"></i>
        <span>${message}</span>
    `;
    element.className = `system-status ${status}`;
}

// Cache fonksiyonları
function cacheData(data) {
    try {
        const cache = {
            data: data,
            timestamp: Date.now(),
            count: data.length
        };
        localStorage.setItem('truesignal_cache', JSON.stringify(cache));
        console.log(`[CACHE] ${data.length} emir cache'e kaydedildi`);
    } catch (error) {
        console.warn('[CACHE] Kaydedilemedi:', error);
    }
}

function loadFromCache() {
    try {
        const cached = localStorage.getItem('truesignal_cache');
        if (!cached) return false;
        
        const cache = JSON.parse(cached);
        const cacheAge = Date.now() - cache.timestamp;
        
        if (cacheAge < CACHE_EXPIRY && cache.data && cache.data.length > 0) {
            console.log(`[CACHE] ${cache.data.length} emir cache'den yüklendi (${Math.round(cacheAge/1000)}s önce)`);
            
            emirListesi = cache.data;
            updateTable();
            updateStats();
            
            const element = document.getElementById('lastUpdate');
            if (element) {
                const time = new Date(cache.timestamp);
                element.innerHTML = `
                    <i class="fas fa-database"></i>
                    <span>Cache'den: ${time.toLocaleTimeString('tr-TR')}</span>
                    <small class="text-muted">(${Math.round(cacheAge / 1000)} saniye önce)</small>
                `;
            }
            
            return true;
        }
    } catch (error) {
        console.error('[CACHE ERROR]:', error);
    }
    return false;
}

// UI Fonksiyonları
function showLoading(show) {
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loading) loading.style.display = show ? 'flex' : 'none';
    if (errorMessage && !show) errorMessage.style.display = 'none';
}

function showError(message) {
    const error = document.getElementById('errorMessage');
    const errorText = error ? error.querySelector('#errorText') : null;
    const retryBtn = document.getElementById('retryBtn');
    
    if (error) {
        error.style.display = 'block';
        if (errorText) errorText.textContent = message;
    }
    if (retryBtn) retryBtn.style.display = 'block';
    
    // Tabloyu gizle
    const table = document.getElementById('emirlerTable');
    if (table) table.style.display = 'none';
    
    showLoading(false);
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                          type === 'error' ? 'fa-exclamation-circle' : 
                          'fa-info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) notification.remove();
    }, 5000);
}

// Yardımcı fonksiyonlar
function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || value === '' || value === '-') return '-';
    const num = parseFloat(value);
    return isNaN(num) ? value : num.toFixed(decimals);
}

function formatDateTime(datetimeStr) {
    if (!datetimeStr) return '-';
    try {
        const date = new Date(datetimeStr);
        if (!isNaN(date.getTime())) {
            return date.toLocaleString('tr-TR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        return datetimeStr;
    } catch (error) {
        return datetimeStr;
    }
}

// Global fonksiyonlar
window.viewDetails = function(index) {
    if (index >= 0 && index < emirListesi.length) {
        const emir = emirListesi[index];
        const details = `
Emir Detayları:
──────────────
ID: ${emir.Id || emir.ID || index + 1}
Sembol: ${emir.Sembol || 'N/A'}
Tip: ${emir.Tip || 'N/A'}
Durum: ${emir.Status || 'N/A'}
Lot: ${formatNumber(emir.Lot)}
Giriş Fiyatı: ${formatNumber(emir.GirisFiyati, 4)}
Kapanış Fiyatı: ${formatNumber(emir.KapanisFiyati, 4)}
Stop Loss: ${emir.StopLoss || 'Yok'}
Take Profit: ${emir.TakeProfit || 'Yok'}
Kar/Zarar: ${formatNumber(emir.KarZarar, 2)} (${formatNumber(emir.KarZararYuzde, 2)}%)
Emir Zamanı: ${formatDateTime(emir.FormatliEmirZamani || emir.EmirZamani)}
Kapanış Zamanı: ${formatDateTime(emir.FormatliKapanisZamani || emir.KapanisZamani)}
Not: ${emir.Comment || 'Yok'}
──────────────
        `;
        alert(details);
    }
};

// Sayfa yüklendiğinde
window.addEventListener('load', function() {
    document.body.classList.add('loaded');
    
    setTimeout(() => {
        const spinner = document.querySelector('.page-spinner');
        if (spinner) spinner.remove();
    }, 500);
});