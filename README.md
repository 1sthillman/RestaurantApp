# RestaurantApp - Gerçek Zamanlı Müşteri Sipariş Sistemi

Bu proje, Supabase kullanarak gerçek zamanlı çalışan bir restoran sipariş ve yönetim sistemi oluşturmayı amaçlar. Müşteriler QR kod ile masalarına özel menüye erişebilir ve sipariş verebilirken, mutfak ve garsonlar bu siparişleri gerçek zamanlı olarak görebilir ve durumlarını güncelleyebilir.

## Özellikler

- QR kod ile masaya özel menü görüntüleme
- Müşteri sipariş verme
- Sepete ürün ekleme/çıkarma
- Gerçek zamanlı sipariş takibi (Supabase Realtime API)
- Mutfak paneli (siparişleri görme ve durumunu güncelleme)
- Garson paneli (hazır siparişleri servis etme ve teslim etme)
- Masa durumu takibi

## Kurulum

### 1. Supabase Kurulumu

1. [Supabase](https://supabase.com/) hesabı oluşturun.
2. Yeni bir proje oluşturun.
3. `supabase_schema.sql` dosyasındaki SQL kodunu Supabase SQL Editor'e kopyalayıp çalıştırın.

### 2. Proje Ayarları

1. `js/supabase.js` dosyasını açın.
2. Supabase URL ve API anahtarlarınızı aşağıdaki değişkenlerle güncelleyin:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. Projeyi Çalıştırma

Proje statik HTML, CSS ve JavaScript dosyalarından oluştuğu için herhangi bir web sunucusu ile çalıştırılabilir. GitHub Pages, Netlify, Vercel gibi platformlarda da kolayca host edilebilir.

Yerel geliştirme için:

```bash
# Python ile basit bir web sunucusu başlatma
python -m http.server 8000
```

## Proje Yapısı

```
RestaurantApp/
│
├── index.html          # Ana sayfa
├── menu.html           # Müşteri menü ve sipariş sayfası
├── kitchen.html        # Mutfak personeli paneli
├── waiter.html         # Garson paneli
│
├── css/
│   └── style.css       # Stil dosyası
│
├── js/
│   ├── supabase.js     # Supabase bağlantı ve ortak işlevler
│   ├── menu.js         # Menü ve sipariş fonksiyonları
│   ├── kitchen.js      # Mutfak paneli fonksiyonları
│   └── waiter.js       # Garson paneli fonksiyonları
│
├── images/             # Görsel dosyaları
│
└── supabase_schema.sql # Veritabanı şeması
```

## Kullanım

1. Ana sayfa (`index.html`) üzerinden ilgili panele geçiş yapabilirsiniz.
2. Müşteri siparişi için masalardaki QR kodlar `menu.html?masa=ID` şeklinde URL'lere yönlendirilmelidir.
3. Masadaki müşteri menüyü görüntüleyebilir, sepete ürün ekleyebilir ve sipariş verebilir.
4. Mutfak personeli hazırlanacak siparişleri görebilir ve hazırlandığında durumunu güncelleyebilir.
5. Garsonlar hazır olan siparişleri görebilir, servise alabilir ve teslim edildiğinde durumunu güncelleyebilir.

## Supabase Tabloları

1. **products**: Menü ürünlerini içerir (id, ad, fiyat, resim)
2. **orders**: Siparişleri içerir (id, masa, urunler, durum, kaynak, zaman)
3. **tables**: Masa durumlarını içerir (id, masa_no, durum, aktif_siparis)

## Gerçek Zamanlı Özellikler

- Müşteri sipariş verdiğinde, mutfak paneli anında güncellenir
- Mutfak siparişi hazırladığında, garson paneli anında güncellenir
- Garson siparişi teslim ettiğinde, masa durumu otomatik olarak güncellenir
- Müşteri, siparişinin durumunu gerçek zamanlı olarak görebilir

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır. 