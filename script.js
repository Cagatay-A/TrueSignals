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

// YENİ loadDataFromGitHub() - ÇALIŞAN VERSİYON
async function loadDataFromGitHub() {
    try {
        showLoading(true);
        
        // Cache busting için timestamp
        const cacheBuster = '?t=' + Date.now();
        
        console.log('[FETCH] Trying Raw GitHub URL for fresh data:', RAW_GITHUB_URL + cacheBuster);
        
        // SADECE RAW GITHUB URL'sini kullan (cache sorunu için)
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
        
        const responseText = await response.text();
        console.log('[FETCH SUCCESS] Response length:', responseText.length);
        console.log('[FETCH SUCCESS] First 500 chars:', responseText.substring(0, 500));
        
        // JSON parse öncesi temizleme
        let cleanedText = responseText.trim();
        if (cleanedText.startsWith('"') && cleanedText.endsWith('"')) {
            cleanedText = cleanedText.substring(1, cleanedText.length - 1);
            cleanedText = cleanedText.replace(/\\"/g, '"');
        }
        
        const data = JSON.parse(cleanedText);
        console.log('[FETCH SUCCESS] Parsed data structure:', {
            success: data.success,
            hasEmirler: !!data.emirler,
            emirlerType: typeof data.emirler,
            keys: Object.keys(data)
        });
        
        processData(data);
        
    } catch (error) {
        console.error('[FETCH ERROR]', error);
        
        // Fallback: GitHub Pages URL
        try {
            console.log('[FETCH FALLBACK] Trying GitHub Pages as fallback');
            const fallbackResponse = await fetch(GITHUB_PAGES_URL + '?t=' + Date.now(), {
                cache: 'no-store'
            });
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log('[FETCH FALLBACK] GitHub Pages data loaded');
                processData(fallbackData);
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

// GÜNCELLENMİŞ processData() - HATASIZ VERSİYON
function processData(data) {
    console.log('[PROCESS] Starting data processing...');
    console.log('[PROCESS] Raw data received:', {
        success: data.success,
        hasEmirler: !!data.emirler,
        emirlerType: typeof data.emirler,
        emirlerKeys: data.emirler ? Object.keys(data.emirler) : 'none'
    });
    
    let processedData = [];
    let timestamp = new Date().toISOString();
    let source = 'github';
    let success = true;
    
    // FIXED DATA PARSING LOGIC
    if (data.success === true && data.emirler) {
        // CASE 1: data.emirler is an object with emirler array inside
        if (typeof data.emirler === 'object' && data.emirler.emirler && Array.isArray(data.emirler.emirler)) {
            processedData = data.emirler.emirler;
            timestamp = data.lastFetch || timestamp;
            source = data.source || source;
            success = data.emirler.success !== false;
            console.log(`[PROCESS CASE 1] Double-nested structure: ${processedData.length} emir found`);
            
        } 
        // CASE 2: data.emirler is directly an array
        else if (Array.isArray(data.emirler)) {
            processedData = data.emirler;
            timestamp = data.lastFetch || timestamp;
            source = data.source || source;
            success = data.success;
            console.log(`[PROCESS CASE 2] Direct array structure: ${processedData.length} emir found`);
            
        } 
        // CASE 3: data.emirler is an object but no emirler array
        else if (typeof data.emirler === 'object') {
            console.log('[PROCESS CASE 3] emirler is object but no emirler array:', data.emirler);
            // Try to convert object values to array
            processedData = Object.values(data.emirler).filter(item => 
                typeof item === 'object' && item !== null
            );
            timestamp = data.lastFetch || timestamp;
            source = data.source || source;
            success = data.success;
            console.log(`[PROCESS CASE 3] Converted object to array: ${processedData.length} emir found`);
        }
    } 
    // CASE 4: Initial template or error
    else if (data.success === false) {
        console.log('[PROCESS CASE 4] Initial template or error state:', data.message || 'No message');
        processedData = [];
        success = false;
        timestamp = data.lastFetch || timestamp;
        source = data.source || source;
    }
    
    // DEBUG: Show first emir if available
    if (processedData.length > 0) {
        console.log('[PROCESS DEBUG] First emir object:', processedData[0]);
        console.log('[PROCESS DEBUG] First emir keys:', Object.keys(processedData[0]));
        console.log('[PROCESS DEBUG] First emir values:', {
            Sembol: processedData[0].Sembol,
            Tip: processedData[0].Tip,
            Status: processedData[0].Status,
            KarZarar: processedData[0].KarZarar
        });
    }
    
    // Fix Turkish encoding in each emir
    if (processedData.length > 0) {
        processedData = processedData.map(emir => fixTurkishEncodingInObject(emir));
    }
    
    // Cache data
    if (processedData.length > 0) {
        cacheData(processedData);
    }
    
    // Update UI
    emirListesi = processedData;
    updateTable();
    showTable();
    updateStats();
    updateLastUpdate(timestamp, source, success);
    updateSystemStatus();
    
    console.log(`[PROCESS FINAL] ${processedData.length} emir processed, Success: ${success}`);
    
    // Show notification
    if (processedData.length > 0) {
        showNotification(`${processedData.length} emir başarıyla yüklendi`, 'success');
    } else if (success === false) {
        showNotification('GitHub Actions henüz çalışmadı veya emir bulunmuyor', 'warning');
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
        'UlaÅŸÄ±ldÄ±': 'Ulaşıldı'
    };
    
    let fixedText = text;
    for (const [wrong, correct] of Object.entries(replacements)) {
        fixedText = fixedText.replace(new RegExp(wrong, 'g'), correct);
    }
    
    return fixedText;
}

// Fix Turkish encoding in an object recursively
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
    } else {
        return obj;
    }
}

// Update table (tablo görünümü)
function updateTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) {
        console.warn('[TABLE] tableBody not found');
        return;
    }
    
    if (emirListesi.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="17" style="text-align: center; padding: 50px;">
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
        const sembol = emir.Sembol || emir.symbol || 'N/A';
        const tip = emir.Tip || emir.type || 'N/A';
        const durum = emir.Status || emir.Durum || 'N/A';
        const lot = emir.Lot || emir.volume || '0';
        const giris = emir.GirisFiyati || emir.entry_price || '0';
        const stopLoss = emir.StopLoss || emir.stop_loss || '-';
        const takeProfit = emir.TakeProfit || emir.take_profit || '-';
        const kapanis = emir.KapanisFiyati || emir.current_price || '0';
        const karZarar = parseFloat(emir.KarZarar) || 0;
        const karZararYuzde = parseFloat(emir.KarZararYuzde) || 0;
        const tarih = emir.FormatliEmirZamani || emir.EmirZamani || emir['Tarih/Saat'] || 'N/A';
        const comment = emir.Comment || '-';
        
        // Durum badge'i
        let statusBadge = '';
        if (durum.toLowerCase().includes('açık') || durum.toLowerCase().includes('open')) {
            statusBadge = `<span class="status-badge status-open">${durum}</span>`;
        } else if (durum.toLowerCase().includes('kapalı') || durum.toLowerCase().includes('closed')) {
            statusBadge = `<span class="status-badge status-closed">${durum}</span>`;
        } else if (durum.toLowerCase().includes('hedef') || durum.toLowerCase().includes('target')) {
            statusBadge = `<span class="status-badge status-target">${durum}</span>`;
        } else if (durum.toLowerCase().includes('zarar') || durum.toLowerCase().includes('stop') || durum.toLowerCase().includes('loss')) {
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
                <td>${formatNumber(stopLoss, 4)}</td>
                <td>${formatNumber(takeProfit, 4)}</td>
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
    const stats = calculateStats();
    
    const elements = {
        'toplamEmir': stats.total,
        'acikEmirler': stats.open,
        'kapaliEmirler': stats.closed,
        'toplamKarZarar': `${formatNumber(stats.totalProfit, 2)}`
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            
            if (id === 'toplamKarZarar') {
                element.className = stats.totalProfit >= 0 ? 'positive' : 'negative';
            }
        }
    });
    
    // Update page title
    document.title = stats.total > 0 
        ? `(${stats.total}) TrueSignal - Emir Takip` 
        : 'TrueSignal - Emir Takip';
}

// Calculate statistics
function calculateStats() {
    const total = emirListesi.length;
    
    const open = emirListesi.filter(e => {
        const durum = (e.Status || e.Durum || '').toLowerCase();
        return durum.includes('açık') || durum.includes('open');
    }).length;
    
    const closed = total - open;
    
    const totalProfit = emirListesi.reduce((sum, emir) => {
        return sum + (parseFloat(emir.KarZarar) || 0);
    }, 0);
    
    return { total, open, closed, totalProfit };
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
        // Try to parse as Date
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
        // If not a valid date, return original
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
Durum: ${emir.Status || emir.Durum || 'N/A'}
Lot: ${formatNumber(emir.Lot) || '0'}
Giriş Fiyatı: ${formatNumber(emir.GirisFiyati, 4) || '0'}
Kapanış Fiyatı: ${formatNumber(emir.KapanisFiyati, 4) || '0'}
Stop Loss: ${emir.StopLoss || 'Yok'}
Take Profit: ${emir.TakeProfit || 'Yok'}
Kar/Zarar: ${formatNumber(emir.KarZarar, 2) || '0'} (${formatNumber(emir.KarZararYuzde, 2) || '0'}%)
Emir Zamanı: ${formatDateTime(emir.FormatliEmirZamani || emir.EmirZamani)}
Kapanış Zamanı: ${formatDateTime(emir.FormatliKapanisZamani || emir.KapanisZamani)}
Not: ${emir.Comment || 'Yok'}
──────────────
GitHub Actions ile otomatik çekilmiştir.
        `;
        alert(details);
    }
};

// Filtreleme fonksiyonu
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const typeFilter = document.getElementById('typeFilter')?.value || '';
    const symbolFilter = document.getElementById('symbolFilter')?.value.toLowerCase() || '';
    const dateFilter = document.getElementById('dateFilter')?.value || '';
    
    const rows = document.querySelectorAll('#emirlerTable tbody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const status = row.cells[9]?.textContent || '';
        const type = row.cells[3]?.textContent || '';
        const symbol = row.cells[2]?.textContent?.toLowerCase() || '';
        const date = row.cells[1]?.textContent || '';
        
        let show = true;
        
        if (statusFilter && !status.includes(statusFilter)) {
            show = false;
        }
        
        if (typeFilter && type !== typeFilter) {
            show = false;
        }
        
        if (symbolFilter && !symbol.includes(symbolFilter)) {
            show = false;
        }
        
        if (dateFilter && !date.includes(dateFilter)) {
            show = false;
        }
        
        row.style.display = show ? '' : 'none';
        if (show) visibleCount++;
    });
    
    // Filtre sonucunu göster
    const tableTitle = document.querySelector('.table-title');
    if (tableTitle && rows.length > 0) {
        const originalText = tableTitle.textContent.replace(/\(\d+\/\d+\)/, '').trim();
        tableTitle.textContent = `${originalText} (${visibleCount}/${rows.length})`;
    }
}

// Initialize on load
window.addEventListener('load', function() {
    document.body.classList.add('loaded');
    
    setTimeout(() => {
        const spinner = document.querySelector('.page-spinner');
        if (spinner) spinner.remove();
    }, 500);
});