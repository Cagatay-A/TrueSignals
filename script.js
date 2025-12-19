// CONFIGURATION
const GITHUB_PAGES_URL = "https://cagatay-a.github.io/TrueSignals/api-data.json";
const RAW_GITHUB_URL = "https://raw.githubusercontent.com/Cagatay-A/TrueSignals/main/public/api-data.json";
const REFRESH_INTERVAL = 30000; // 30 seconds
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 dakika

// DOM Elements
let emirListesi = [];
let isInitialLoad = true;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('[INIT] TrueSignal Emir Takip Sistemi yüklendi');
    console.log('[CONFIG] GitHub Pages URL:', GITHUB_PAGES_URL);
    console.log('[CONFIG] Raw GitHub URL:', RAW_GITHUB_URL);
    
    // Load initial data
    const cacheLoaded = loadFromCache();
    
    setTimeout(() => {
        loadDataFromGitHub();
        isInitialLoad = false;
    }, cacheLoaded ? 1000 : 0);
    
    // Auto refresh
    setInterval(loadDataFromGitHub, REFRESH_INTERVAL);
    
    // Event listeners
    setupEventListeners();
    
    // İlk yüklemede sistem durumunu göster
    updateSystemStatus();
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
    
    // Retry button
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
        retryBtn.addEventListener('click', function() {
            console.log('[RETRY] Tekrar deneme başlatıldı');
            this.style.display = 'none';
            loadDataFromGitHub();
        });
    }
    
    // Network events
    window.addEventListener('online', function() {
        console.log('[NETWORK] İnternet bağlantısı sağlandı');
        showNotification('İnternet bağlantısı sağlandı, veriler yenileniyor', 'success');
        loadDataFromGitHub();
    });
    
    window.addEventListener('offline', function() {
        console.log('[NETWORK] İnternet bağlantısı kesildi');
        showNotification('İnternet bağlantısı kesildi, cache verileri gösteriliyor', 'warning');
    });
    
    // Page visibility
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && !isInitialLoad) {
            console.log('[VISIBILITY] Sayfa tekrar görünür oldu, veriler yenileniyor...');
            loadDataFromGitHub();
        }
    });
}

// YENİ VE BASİT loadDataFromGitHub()
async function loadDataFromGitHub() {
    try {
        showLoading(true);
        
        // Cache busting için timestamp
        const cacheBuster = '?t=' + Date.now();
        
        console.log('[FETCH] Loading from:', RAW_GITHUB_URL + cacheBuster);
        
        // SADECE RAW GITHUB URL'sini kullan
        const response = await fetch(RAW_GITHUB_URL + cacheBuster, {
            headers: { 
                'Accept': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[FETCH SUCCESS] Data structure check:', {
            success: data.success,
            hasEmirler: !!data.emirler,
            emirlerType: typeof data.emirler,
            hasNestedEmirler: data.emirler && data.emirler.emirler ? true : false
        });
        
        processDataSimple(data);
        
    } catch (error) {
        console.error('[FETCH ERROR]', error);
        
        // Fallback: GitHub Pages URL
        try {
            console.log('[FETCH FALLBACK] Trying GitHub Pages');
            const fallbackResponse = await fetch(GITHUB_PAGES_URL + '?t=' + Date.now(), {
                cache: 'no-store'
            });
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log('[FETCH FALLBACK] GitHub Pages data loaded');
                processDataSimple(fallbackData);
                return;
            }
        } catch (fallbackError) {
            console.error('[FETCH FALLBACK ERROR]', fallbackError);
        }
        
        // Cache'den yükle
        if (!loadFromCache()) {
            showError("Veriler yüklenemedi. Lütfen sayfayı yenileyin (Ctrl+F5).");
        }
    } finally {
        showLoading(false);
    }
}

// BASİT VE ETKİLİ processDataSimple() - BU KESİN ÇALIŞIR!
function processDataSimple(data) {
    console.log('[PROCESS] Starting simple data processing...');
    console.log('[PROCESS] Full data object:', data);
    
    let processedData = [];
    let timestamp = new Date().toISOString();
    let source = 'github';
    let success = false;
    
    // EN BASİT YAKLAŞIM: Tüm olasılıkları kontrol et
    if (data.success === true) {
        success = true;
        timestamp = data.lastFetch || timestamp;
        source = data.source || source;
        
        // DURUM 1: İç içe yapı - {emirler: {emirler: [...], success: true}}
        if (data.emirler && data.emirler.emirler && Array.isArray(data.emirler.emirler)) {
            processedData = data.emirler.emirler;
            console.log(`[PROCESS] CASE 1 - Nested structure: ${processedData.length} emir`);
        }
        // DURUM 2: Düz yapı - {emirler: [...], success: true}
        else if (data.emirler && Array.isArray(data.emirler)) {
            processedData = data.emirler;
            console.log(`[PROCESS] CASE 2 - Flat array: ${processedData.length} emir`);
        }
        // DURUM 3: emirler bir nesne ama emirler dizisi yok
        else if (data.emirler && typeof data.emirler === 'object') {
            console.log('[PROCESS] CASE 3 - Object without emirler array, checking structure:', data.emirler);
            // Eğer nesnenin içinde dizi varsa onu al
            for (const key in data.emirler) {
                if (Array.isArray(data.emirler[key])) {
                    processedData = data.emirler[key];
                    console.log(`[PROCESS] Found array in property "${key}": ${processedData.length} emir`);
                    break;
                }
            }
        }
    } else if (data.success === false) {
        console.log('[PROCESS] CASE 4 - Initial template:', data.message);
        success = false;
        timestamp = data.lastFetch || timestamp;
        source = data.source || source;
        processedData = [];
    }
    
    // DEBUG: Verileri göster
    console.log(`[PROCESS RESULT] Processed ${processedData.length} emir, Success: ${success}`);
    if (processedData.length > 0) {
        console.log('[PROCESS DEBUG] First emir details:', {
            Sembol: processedData[0].Sembol,
            Tip: processedData[0].Tip,
            Status: processedData[0].Status,
            KarZarar: processedData[0].KarZarar,
            Comment: processedData[0].Comment
        });
        console.log('[PROCESS DEBUG] All emir keys:', Object.keys(processedData[0]));
    }
    
    // Update global list
    emirListesi = processedData;
    
    // Update UI
    updateTable();
    updateStats();
    updateLastUpdate(timestamp, source, success);
    updateSystemStatus();
    
    // Show notification
    if (processedData.length > 0) {
        showNotification(`${processedData.length} emir başarıyla yüklendi`, 'success');
    } else if (!success) {
        showNotification('GitHub Actions henüz çalışmadı', 'warning');
    }
}

// Fix Turkish encoding in a string
function fixTurkishEncoding(text) {
    if (typeof text !== 'string') return text;
    
    const replacements = {
        'Ä±': 'ı',
        'ÄŸ': 'ğ',
        'ÅŸ': 'ş',
        'Ã§': 'ç',
        'Ã¶': 'ö',
        'Ã¼': 'ü',
        'Ä°': 'İ',
        'ÄŸ': 'Ğ',
        'Åž': 'Ş',
        'Ã‡': 'Ç',
        'Ã–': 'Ö',
        'Ãœ': 'Ü',
        'KapalÄ±': 'Kapalı',
        'UlaÅŸÄ±ldÄ±': 'Ulaşıldı',
        // Unicode escape sequences
        '\\u0131': 'ı',
        '\\u0130': 'İ',
        '\\u011f': 'ğ',
        '\\u011e': 'Ğ',
        '\\u015f': 'ş',
        '\\u015e': 'Ş',
        '\\u00e7': 'ç',
        '\\u00c7': 'Ç',
        '\\u00f6': 'ö',
        '\\u00d6': 'Ö',
        '\\u00fc': 'ü',
        '\\u00dc': 'Ü'
    };
    
    let fixedText = text;
    for (const [wrong, correct] of Object.entries(replacements)) {
        fixedText = fixedText.replace(new RegExp(wrong, 'g'), correct);
    }
    
    return fixedText;
}

// Fix Turkish encoding in an object
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

// Update table (tablo görünümü)
function updateTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) {
        console.error('[TABLE] tableBody not found!');
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
        // Fix Turkish characters
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
        
        // Durum badge'i
        let statusBadge = '';
        const durumLower = durum.toLowerCase();
        if (durumLower.includes('açık') || durumLower.includes('open')) {
            statusBadge = `<span class="status-badge status-open">${durum}</span>`;
        } else if (durumLower.includes('kapalı') || durumLower.includes('closed')) {
            statusBadge = `<span class="status-badge status-closed">${durum}</span>`;
        } else if (durumLower.includes('hedef') || durumLower.includes('target')) {
            statusBadge = `<span class="status-badge status-target">${durum}</span>`;
        } else if (durumLower.includes('zarar') || durumLower.includes('stop') || durumLower.includes('loss')) {
            statusBadge = `<span class="status-badge status-stop">${durum}</span>`;
        } else {
            statusBadge = `<span class="status-badge">${durum}</span>`;
        }
        
        // Kar/Zarar renk sınıfı
        const karZararClass = karZarar >= 0 ? 'positive' : 'negative';
        const karZararText = karZarar >= 0 ? `+${formatNumber(karZarar, 2)}` : formatNumber(karZarar, 2);
        const karZararYuzdeText = karZararYuzde >= 0 ? `+${formatNumber(karZararYuzde, 2)}%` : `${formatNumber(karZararYuzde, 2)}%`;
        
        // Tip renk sınıfı
        const tipClass = tip.toLowerCase().includes('al') || tip.toLowerCase().includes('buy') ? 'positive' : 'negative';
        
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
    console.log(`[TABLE] Updated with ${emirListesi.length} rows`);
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

// Update statistics
function updateStats() {
    const total = emirListesi.length;
    
    const open = emirListesi.filter(e => {
        const durum = (e.Status || '').toLowerCase();
        return durum.includes('açık') || durum.includes('open');
    }).length;
    
    const closed = total - open;
    
    const totalProfit = emirListesi.reduce((sum, emir) => {
        return sum + (parseFloat(emir.KarZarar) || 0);
    }, 0);
    
    // Update elements
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
    
    // Update page title
    document.title = total > 0 
        ? `(${total}) TrueSignal - Emir Takip` 
        : 'TrueSignal - Emir Takip';
}

// Update last update time
function updateLastUpdate(timestamp, source, success) {
    const element = document.getElementById('lastUpdate');
    if (!element) return;
    
    try {
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString('tr-TR');
        const dateStr = date.toLocaleDateString('tr-TR');
        
        let sourceText = source;
        if (source.includes('192.168.1.3')) sourceText = 'Local API';
        if (source === 'github') sourceText = 'GitHub';
        
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

// Update system status
function updateSystemStatus() {
    const element = document.getElementById('systemStatus');
    if (!element) return;
    
    const now = new Date();
    const hour = now.getHours();
    
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
    } else if (hour < 9 || hour > 18) {
        status = 'info';
        message = 'Mesai saatleri dışında';
        icon = 'fa-moon';
    }
    
    element.innerHTML = `
        <i class="fas ${icon} ${status}"></i>
        <span>${message}</span>
    `;
    element.className = `system-status ${status}`;
}

// Cache functions
function cacheData(data) {
    try {
        const cache = {
            data: data,
            timestamp: Date.now(),
            count: data.length
        };
        localStorage.setItem('truesignal_cache', JSON.stringify(cache));
        console.log(`[CACHE] ${data.length} emir cached`);
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
            console.log(`[CACHE] ${cache.data.length} emir cache'den yüklendi (${Math.round(cacheAge/1000)}s ago)`);
            
            emirListesi = cache.data;
            updateTable();
            showTable();
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

// UI Functions
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
        if (errorText) errorText.innerHTML = message;
    }
    if (retryBtn) retryBtn.style.display = 'block';
    
    // Tabloyu da gizle
    const table = document.getElementById('emirlerTable');
    if (table) table.style.display = 'none';
    
    // Loading'i gizle
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

// Utility functions
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

// Global functions
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

// Initialize on load
window.addEventListener('load', function() {
    document.body.classList.add('loaded');
    
    setTimeout(() => {
        const spinner = document.querySelector('.page-spinner');
        if (spinner) spinner.remove();
    }, 500);
});