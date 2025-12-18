// API URL - GitHub Pages'teki JSON dosyası
const API_URL = "https://cagatay-a.github.io/TrueSignals/api-data.json";

// DOM elementleri
let table, tableBody, loading, errorMessage, refreshBtn, retryBtn, lastUpdate;

// DOM elementlerini başlat
function initDOM() {
    table = document.getElementById('emirlerTable');
    tableBody = document.getElementById('tableBody');
    loading = document.getElementById('loading');
    errorMessage = document.getElementById('errorMessage');
    refreshBtn = document.getElementById('refreshBtn');
    retryBtn = document.getElementById('retryBtn');
    lastUpdate = document.getElementById('lastUpdate');
}

// Veri yükleme fonksiyonu
async function loadData() {
    try {
        console.log('[API] GitHub Pages\'ten veri alınıyor:', API_URL);
        
        // Yükleniyor göster
        if (loading) loading.style.display = 'block';
        if (table) table.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'none';
        
        // GitHub Pages'ten JSON verisini çek
        const response = await fetch(API_URL, {
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[API] Veri alındı:', result);
        
        // Veriyi işle
        processData(result);
        
    } catch (error) {
        console.error('[API ERROR] Veri yüklenirken hata oluştu:', error);
        handleError(error);
    }
}

// Veriyi işleme fonksiyonu
function processData(result) {
    let data = [];
    let updateTime = new Date().toLocaleTimeString('tr-TR');
    
    // Farklı veri formatlarını destekle
    if (result.success !== undefined && result.emirler) {
        // Format: { success: true, lastFetch: "...", emirler: [...] }
        data = result.emirler || [];
        updateTime = result.lastFetch ? 
            new Date(result.lastFetch).toLocaleTimeString('tr-TR') : 
            updateTime;
        console.log(`[API] Format 1 - ${data.length} emir bulundu`);
        
    } else if (Array.isArray(result)) {
        // Format: Direkt array [ {...}, {...} ]
        data = result;
        console.log(`[API] Format 2 - ${data.length} emir bulundu`);
        
    } else {
        console.warn('[API] Geçerli veri formatı değil:', result);
        data = [];
    }
    
    // Tabloyu doldur
    populateTable(data);
    
    // Son güncelleme zamanını göster
    if (lastUpdate) {
        lastUpdate.textContent = `Son güncelleme: ${updateTime}`;
    }
    
    // Başarılı
    if (loading) loading.style.display = 'none';
    if (table) table.style.display = 'table';
    
    console.log(`[SUCCESS] ${data.length} emir yüklendi`);
    
    // Tarayıcı başlığını güncelle
    updateTabTitle(data.length);
    
    // Veriyi cache'le
    cacheData(data);
}

// Hata yönetimi
function handleError(error) {
    if (loading) loading.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'block';
    if (table) table.style.display = 'none';
    
    // Hata mesajını güncelle
    const errorText = errorMessage ? errorMessage.querySelector('p') : null;
    if (errorText) {
        errorText.textContent = `GitHub Pages'ten veri yüklenirken hata: ${error.message}. Lütfen daha sonra tekrar deneyin.`;
    }
    
    // Butonu göster
    if (retryBtn) {
        retryBtn.style.display = 'block';
    }
    
    // Cache'den veri yükle
    loadFromCache();
}

// Veriyi cache'leme
function cacheData(data) {
    try {
        localStorage.setItem('emirler_cache', JSON.stringify(data));
        localStorage.setItem('emirler_cache_time', Date.now().toString());
        console.log('[CACHE] Veri cache\'lendi');
    } catch (e) {
        console.warn('[CACHE] LocalStorage\'a yazılamadı:', e);
    }
}

// Cache'den veri yükle
function loadFromCache() {
    try {
        const cachedData = localStorage.getItem('emirler_cache');
        const cacheTime = localStorage.getItem('emirler_cache_time');
        
        if (cachedData && cacheTime) {
            const data = JSON.parse(cachedData);
            const now = Date.now();
            const cacheAge = now - parseInt(cacheTime);
            
            // Eğer cache 30 dakikadan eski değilse
            if (cacheAge < 30 * 60 * 1000 && data.length > 0) {
                console.log('[CACHE] Cache\'den veri yükleniyor...');
                
                populateTable(data);
                
                const cacheDate = new Date(parseInt(cacheTime));
                if (lastUpdate) {
                    lastUpdate.textContent = `Son güncelleme: ${cacheDate.toLocaleTimeString('tr-TR')} (Cache)`;
                }
                
                if (loading) loading.style.display = 'none';
                if (errorMessage) errorMessage.style.display = 'none';
                if (table) table.style.display = 'table';
                
                showNotification(`${data.length} emir cache'den yüklendi`, 'info');
                return true;
            }
        }
    } catch (e) {
        console.error('[CACHE ERROR] Cache yüklenemedi:', e);
    }
    return false;
}

// Tabloyu doldurma fonksiyonu
function populateTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="17" style="text-align: center; color: #666; padding: 40px;">
                    <i class="fas fa-database fa-2x mb-3"></i><br>
                    Gösterilecek emir bulunamadı.
                </td>
            </tr>
        `;
        return;
    }
    
    data.forEach((item, index) => {
        const row = document.createElement('tr');
        
        // Duruma göre renk sınıfı
        let durumClass = '';
        let durumText = item.Durum || item.Status || item.durum || '-';
        
        if (durumText.includes('AL') || durumText.includes('BUY') || durumText === 'Açık' || durumText === 'Open') {
            durumClass = 'positive';
        } else if (durumText.includes('SAT') || durumText.includes('SELL') || durumText === 'Kapalı' || durumText === 'Closed') {
            durumClass = 'negative';
        } else {
            durumClass = 'neutral';
        }
        
        // RSI değerine göre renk
        let rsiClass = '';
        const rsiValue = parseFloat(item.RSI || item.rsi);
        if (!isNaN(rsiValue)) {
            if (rsiValue > 70) rsiClass = 'negative';
            else if (rsiValue < 30) rsiClass = 'positive';
        }
        
        // Tarih formatını düzenle
        let tarihSaat = item['Tarih/Saat'] || item.Tarih || item.Saat || item.EmirZamani || item.created_at || '';
        
        // Kar/zarar değerini formatla
        let karZarar = item.KarZarar || item.profit || item.PLRatio || 0;
        let karZararYuzde = item.KarZararYuzde || item.profit_percentage || 0;
        let karZararClass = karZarar >= 0 ? 'positive' : 'negative';
        
        row.innerHTML = `
            <td>${item.Id || item.ID || item.id || index + 1}</td>
            <td>${formatDateTime(tarihSaat)}</td>
            <td><strong>${item.Sembol || item.symbol || item.Coin || '-'}</strong></td>
            <td>${item.Tip || item.type || item.SignalType || '-'}</td>
            <td>${formatNumber(item.Lot || item.volume || item.Amount || '-')}</td>
            <td>${formatNumber(item.GirisFiyati || item.entry_price || item.SignalPrice || '-', 4)}</td>
            <td>${formatNumber(item.StopLoss || item.stop_loss || '-', 4)}</td>
            <td>${formatNumber(item.TakeProfit || item.take_profit || '-', 4)}</td>
            <td>${formatNumber(item.KapanisFiyati || item.current_price || item.CurrentPrice || '-', 4)}</td>
            <td class="${rsiClass}">${!isNaN(rsiValue) ? rsiValue.toFixed(2) : (item.RSI || '-')}</td>
            <td>${item.MACD || item.macd || '-'}</td>
            <td>${item.EMA || item.ema || '-'}</td>
            <td>${item.STOACH || item.stoch || '-'}</td>
            <td class="${durumClass}"><strong>${durumText}</strong></td>
            <td>${item.ListType || '-'}</td>
            <td class="${karZararClass}">
                <strong>${formatNumber(karZarar, 4)}</strong><br>
                <small>${!isNaN(parseFloat(karZararYuzde)) ? parseFloat(karZararYuzde).toFixed(2) + '%' : ''}</small>
            </td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-outline-info" title="Detay Görüntüle" onclick="viewDetails(${index})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" class="btn btn-outline-warning" title="Düzenle" onclick="editOrder(${index})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger" title="Sil" onclick="deleteOrder(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    console.log(`[TABLE] ${data.length} emir tabloya eklendi`);
}

// Yardımcı fonksiyonlar
function formatNumber(value, decimals = 2) {
    if (value === '-' || value === '') return '-';
    const num = parseFloat(value);
    return isNaN(num) ? value : num.toFixed(decimals);
}

function formatDateTime(datetimeStr) {
    if (!datetimeStr) return '-';
    try {
        const date = new Date(datetimeStr);
        if (!isNaN(date.getTime())) {
            return date.toLocaleString('tr-TR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        }
        return datetimeStr.replace('T', ' ').substring(0, 19);
    } catch (error) {
        return datetimeStr;
    }
}

function updateTabTitle(count) {
    document.title = count > 0 ? `(${count}) TrueSignal - Emir Takip` : 'TrueSignal - Emir Takip';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} notification`;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        min-width: 300px; animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
        ${message}
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    console.log('[INIT] Sayfa yüklendi');
    console.log('[CONFIG] API URL:', API_URL);
    
    initDOM();
    
    // Cache'den veri yükle
    const cacheLoaded = loadFromCache();
    
    // API'den güncel veriyi çek
    setTimeout(() => loadData(), cacheLoaded ? 1000 : 0);
    
    // Her 30 saniyede bir otomatik yenile
    setInterval(loadData, 30000);
    
    // Yenile butonuna tıklanınca
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('[REFRESH] Manuel yenileme başlatıldı');
            
            // Butona animasyon ekle
            const originalHTML = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yenileniyor...';
            this.disabled = true;
            
            loadData();
            
            setTimeout(() => {
                this.innerHTML = originalHTML;
                this.disabled = false;
            }, 2000);
        });
    }
    
    // Tekrar dene butonuna tıklanınca
    if (retryBtn) {
        retryBtn.addEventListener('click', function() {
            console.log('[RETRY] Tekrar deneme başlatıldı');
            loadData();
            
            // Butonu gizle
            this.style.display = 'none';
        });
    }
});

// Global fonksiyonlar (index.html'den erişilebilir)
window.viewDetails = function(index) {
    alert(`Emir ${index + 1} detayları gösterilecek`);
};

window.editOrder = function(index) {
    alert(`Emir ${index + 1} düzenlenecek`);
};

window.deleteOrder = function(index) {
    if (confirm(`Emir ${index + 1} silinsin mi?`)) {
        alert(`Emir ${index + 1} silindi`);
    }
};

// Network events
window.addEventListener('online', function() {
    console.log('[NETWORK] İnternet bağlantısı sağlandı');
    showNotification('İnternet bağlantısı sağlandı, veriler yenileniyor', 'success');
    loadData();
});

window.addEventListener('offline', function() {
    console.log('[NETWORK] İnternet bağlantısı kesildi');
    showNotification('İnternet bağlantısı kesildi, cache verileri gösteriliyor', 'warning');
});

// Sayfa görünürlüğü değiştiğinde
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('[VISIBILITY] Sayfa tekrar görünür oldu, veriler yenileniyor...');
        loadData();
    }
});

// Sayfa yüklenme animasyonu
window.addEventListener('load', function() {
    if (document.body) {
        document.body.classList.add('loaded');
    }
    
    // Loading spinner'ı kaldır
    setTimeout(() => {
        const spinner = document.querySelector('.spinner-border');
        if (spinner) {
            spinner.style.opacity = '0';
            setTimeout(() => {
                if (spinner.parentElement) {
                    spinner.parentElement.remove();
                }
            }, 300);
        }
    }, 500);
});

// Responsive tablo kontrolü
function checkTableResponsive() {
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;
    
    if (window.innerWidth < 768) {
        tableContainer.style.overflowX = 'auto';
        tableContainer.style.position = 'relative';
    } else {
        tableContainer.style.overflowX = 'visible';
    }
}

window.addEventListener('resize', checkTableResponsive);

// Hata sayfası yönlendirmesi
if (window.location.pathname.includes('404')) {
    console.log('[404] 404 sayfasındayız, yönlendirme yapılıyor...');
    
    setTimeout(() => {
        window.location.href = '/TrueSignals/';
    }, 3000);
}