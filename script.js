// CONFIGURATION
const API_URL = "./api-data.json";  // GitHub Pages'teki JSON dosyası
const REFRESH_INTERVAL = 30000; // 30 seconds
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 dakika

// DOM Elements
let emirListesi = [];
let isInitialLoad = true;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('[INIT] TrueSignal Emir Takip Sistemi yüklendi');
    console.log('[CONFIG] API URL:', API_URL);
    
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

// script.js'de loadDataFromGitHub fonksiyonunu güncelleyin:
async function loadDataFromGitHub() {
    try {
        showLoading(true);
        
        // Önce relative path'den dene
        let response = await fetch("./api-data.json?t=" + Date.now(), {
            headers: { 'Accept': 'application/json' },
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            // Fallback: absolute GitHub Pages URL
            response = await fetch("https://cagatay-a.github.io/TrueSignals/api-data.json?t=" + Date.now());
        }
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        processData(data);
        
    } catch (error) {
        console.error('[ERROR]', error);
        // Cache'den yükle
        if (!loadFromCache()) {
            showError("Veriler yüklenemedi. Lütfen internet bağlantınızı kontrol edin.");
        }
    } finally {
        showLoading(false);
    }
}

function processData(data) {
    let processedData = [];
    let timestamp = new Date().toISOString();
    let source = 'github';
    let success = true;
    
    console.log('[PROCESS] Processing data:', data);
    
    // Fix Turkish encoding first
    const fixedData = fixTurkishEncoding(data);
    
    // YENİ: İÇ İÇE EMİRLER FORMATI
    if (fixedData.emirler && fixedData.emirler.emirler && Array.isArray(fixedData.emirler.emirler)) {
        // Format: {emirler: {emirler: [...], success: true}}
        processedData = fixedData.emirler.emirler || [];
        timestamp = fixedData.lastFetch || timestamp;
        source = fixedData.source || source;
        success = fixedData.success && fixedData.emirler.success;
        console.log(`[NEW FORMAT] ${processedData.length} emir, Success: ${success}`);
        
    } else if (fixedData.success !== undefined && fixedData.emirler) {
        // Format: {success, lastFetch, source, emirler} (emirler direkt array)
        if (Array.isArray(fixedData.emirler)) {
            processedData = fixedData.emirler;
        } else if (fixedData.emirler && Array.isArray(fixedData.emirler.emirler)) {
            // Nested format
            processedData = fixedData.emirler.emirler || [];
        }
        timestamp = fixedData.lastFetch || timestamp;
        source = fixedData.source || source;
        success = fixedData.success;
        console.log(`[FORMAT 1] ${processedData.length} emir, Success: ${success}`);
        
    } else if (Array.isArray(fixedData.emirler)) {
        // Format: {emirler: [...]}
        processedData = fixedData.emirler;
        console.log(`[FORMAT 2] ${processedData.length} emir`);
        
    } else if (Array.isArray(fixedData)) {
        // Format: Direct array
        processedData = fixedData;
        console.log(`[FORMAT 3] ${processedData.length} emir`);
        
    } else {
        console.warn('[FORMAT WARNING] Bilinmeyen format:', fixedData);
        showError('Veri formatı tanınamadı');
        return;
    }
    
    // Fix Turkish encoding in each emir
    processedData = processedData.map(emir => fixTurkishEncodingInObject(emir));
    
    // Cache data
    cacheData(processedData);
    
    // Update UI
    emirListesi = processedData;
    updateTable();
    showTable();
    updateStats();
    updateLastUpdate(timestamp, source, success);
    updateSystemStatus();
    
    console.log(`[SUCCESS] ${processedData.length} emir işlendi, tablo güncellendi`);
    
    if (processedData.length > 0) {
        showNotification(`${processedData.length} emir başarıyla yüklendi`, 'success');
        
        // Filtreleri uygula
        setTimeout(applyFilters, 500);
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
        const rsi = emir.RSI || '-';
        const macd = emir.MACD || '-';
        const ema = emir.EMA || '-';
        const stoach = emir.STOACH || '-';
        const listType = emir.ListType || '-';
        
        // Durum badge'i
        let statusBadge = '';
        if (durum.toLowerCase().includes('açık')) {
            statusBadge = `<span class="status-badge status-open">${durum}</span>`;
        } else if (durum.toLowerCase().includes('kapalı')) {
            statusBadge = `<span class="status-badge status-closed">${durum}</span>`;
        } else if (durum.toLowerCase().includes('hedef')) {
            statusBadge = `<span class="status-badge status-target">${durum}</span>`;
        } else if (durum.toLowerCase().includes('zarar') || durum.toLowerCase().includes('stop')) {
            statusBadge = `<span class="status-badge status-stop">${durum}</span>`;
        } else {
            statusBadge = durum;
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
                <td>${rsi}</td>
                <td>${macd}</td>
                <td>${ema}</td>
                <td>${stoach}</td>
                <td>${statusBadge}</td>
                <td>${listType}</td>
                <td class="${karZararClass}">
                    ${karZararText}<br>
                    <small>${karZararYuzdeText}</small>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="viewDetails(${index})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="showEmirChart(${index})">
                        <i class="fas fa-chart-line"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
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
        if (source === 'fallback') sourceText = 'Fallback Veri';
        
        element.innerHTML = `
            <i class="fas ${success ? 'fa-check-circle success' : 'fa-exclamation-triangle warning'}"></i>
            <span>Son güncelleme: ${timeStr} (${dateStr})</span>
            <small>Kaynak: ${sourceText}</small>
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
    } else if (emirListesi.some(e => e.Sembol === 'API_UNAVAILABLE')) {
        status = 'error';
        message = 'Local API geçici olarak kapalı';
        icon = 'fa-times-circle';
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
            console.log(`[CACHE] ${cache.data.length} emir cache'den yüklendi`);
            
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
                    <small>(${Math.round(cacheAge / 1000)} saniye önce)</small>
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
Durum: ${emir.Status || emir.Durum || 'N/A'}
Lot: ${emir.Lot || '0'}
Giriş Fiyatı: ${emir.GirisFiyati || '0'}
Kapanış Fiyatı: ${emir.KapanisFiyati || '0'}
Stop Loss: ${emir.StopLoss || 'Yok'}
Take Profit: ${emir.TakeProfit || 'Yok'}
Kar/Zarar: ${emir.KarZarar || '0'} (${emir.KarZararYuzde || '0'}%)
Tarih: ${formatDateTime(emir.FormatliEmirZamani || emir.EmirZamani || '')}
Not: ${emir.Comment || 'Yok'}
──────────────
GitHub Actions ile otomatik çekilmiştir.
        `;
        alert(details);
    }
};

window.showEmirChart = function(index) {
    if (index >= 0 && index < emirListesi.length) {
        const emir = emirListesi[index];
        alert(`Grafik özelliği geliştirme aşamasında!\n\n${emir.Sembol || 'Emir'} için grafik gösterilecek.`);
    }
};

// Filtreleme fonksiyonu (index.html'deki ile uyumlu)
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const typeFilter = document.getElementById('typeFilter')?.value || '';
    const symbolFilter = document.getElementById('symbolFilter')?.value.toLowerCase() || '';
    const dateFilter = document.getElementById('dateFilter')?.value || '';
    
    const rows = document.querySelectorAll('#emirlerTable tbody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const status = row.cells[13]?.textContent || '';
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