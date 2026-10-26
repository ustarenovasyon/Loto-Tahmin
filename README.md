# Loto Tahmin — Strateji Laboratuvarı

Kullanıcının sağladığı **975 gerçek Süper Loto çekilişi** üzerinde çalışan, telefona uygun ve tamamen statik web uygulaması.

## Kullanım
- `index.html` web sayfasını açın veya GitHub Pages ile `main / (root)` klasörünü yayımlayın.
- Hedef numarası geçmişteki veya henüz çekilmemiş bir çekiliş olabilir (ör. **976**). Hedef sonucu olmadan da aynı matematikle aday havuzu hesaplanır; eşleşmeler **Sonuç bekleniyor** olarak gösterilir. Sayılar yalnızca hedef öncesindeki gerçek arşiv kayıtlarından alınır. Eksik kaynak çekiliş varsa açıklama gösterilir; sayı uydurulmaz.
- **Bölme**, **Çarpma**, **Sabit Ekleme**, **Artan Bölenler** ve **Çıkarma** bölümlerinde istediğiniz bölen/çarpan/adım sayısını ayarlayın.
- **Havuzları kaydet**; iki veya daha fazla stratejiyi **ortak/kesişim** ya da **birleşim** şeklinde kıyaslayın.
- **Filtreler** üzerinden son N çekilişte en az X kez görünen sayıları, tekil çekilişleri veya seçtiğiniz rakamları çıkarın.
- Her adımın gerçek altılıları, alınan sayılar, eşleşmeler ve birikimli havuz görünür.
- Kendi TXT verinizi de içe aktarabilirsiniz. Gönderilen arşiv `data/draws.txt` konumundadır.

## Matematik kuralı
Ondalık referans `r = tam + f` için:
- alt çekiliş: **son** `ceil(6 × (1-f))` sayı,
- üst çekiliş: **ilk** `ceil(6 × f)` sayı.
- f=0 ise tam sayıdaki çekilişin altılısı.
- 243,75 ⇒ 243 son 2 + 244 ilk 5 = **7 sayı**.
- 487,5 ⇒ 487 son 3 + 488 ilk 3 = **6 sayı**.
- **İki pay ayrı ayrı yukarı yuvarlanır**, küsürlü sınırlar atılmaz.

İşlemlerde kayan nokta hatası olmaması için kesirler BigInt tabanlı rasyonel olarak hesaplanır. Varsayılan olarak hedef çekiliş ve sonrasından sayı alınmaz. Geçmişe dönük havuzda sayı bulunması gelecek çekiliş için başarı garantisi değildir.

## Kazananlar Kulübü · Ortak Sayılar

Ayrı sayfa: [Kulüp Ortak Sayılar](./club-compare.html)

**Kupon oluşturmadan önce bağımsız sistemler ile kullanıcının kendi havuzunun ortak sayılarını karşılaştırır.**

- Kendi matematik/analiz havuzunu yerel kayıtlardan seç veya 1–60 arasından doğrudan sayı yaz.
- 6 hazır bağımsız kulüp sistemini ve kayıtlı özel sistemlerini yeniden çalıştır.
- Her sistem için 12/24/50/100 farklı örnek kolon üret.
- Her satıra altılı yazarak dış sistemden **kullanıcının kendisinin sağladığı** tahmin kolonlarını ekle. Kaynaklar isim, hedef ve altılılarıyla ayrı saklanır. Örnek DELTA/FLEX/SPOT isimlerinin bulunması, gerçek tahminlerinin otomatik erişildiği anlamına gelmez.
- Sistem başına ilk 6/10/12/15/20/30 güçlü sayı veya o sistemin tüm görülenlerini seç.
- En az K ayrı sistemle ortaklık, bütün sistemlerin tam kesişimi, en az bir sistemde görülenler ya da yalnız kendi havuzunda kalanlar.
- Her sayı için destekleyen sistemler ve örnek kolonlarda tekrar oranı, sistem başına en iyi altılı örtüşmeleri.
- Ortak havuzu kaydet veya tek tuşla Kupon Atölyesi'nde seçilmiş kaynak olarak aç.
- Dışarıdan eklediğin kolon kaynakları cihazındaki analiz yedeğine dahildir.

**Harici kaynak sınırı:** LotoTürkiye kendi tahminlerinin yeniden yayımlanmasını yasaklar; bu uygulama siteyi otomatik kazımaz ve gerçek resmî DELTA/FLEX/SPOT tahminlerini sağlıyormuş gibi davranmaz. Doğrudan üretilen tahminler açık kurallı özgün kulüp sistemlerimizindir. Dış sistem verisi yalnızca kullanıcının kendisinin sağladığı kolonlardır. Kaynak örnekleri bütün sistemin tahmin evrenini temsil etmeyebilir.

**Önemli:** Bir kolon ile 4 veya 5 `ortak havuz sayısı` olması, gelecekteki çekilişte 4 veya 5 gerçek isabet olacağı anlamına gelmez.

## Analiz Merkezi — özgün modüler analiz platformu

Ana matematik sayfasındaki **Analiz Merkezi'ni Aç** bağlantısından veya doğrudan `lab.html` ile erişilir.

### Bağımsız modüller (31)
- **Frekans/Süre:** Çok çıkan, az çıkan, yakın gelen, uzun süredir gelmeyen.
- **Dönem ve ritim:** DNA dönemleri, Limit bekleme, Scope adet/süre, Matriks 4 grup, Radar, Queue, Trend, tekrar/RPT, GRID, List.
- **Birliktelik:** İkili, üçlü, dörtlü, beşli ve takip eden sayılar.
- **Sıralı:** Pozisyonlar, aralıklar, toplamlar, tek/çift, onlu gruplar, son haneler, asal sayılar, ardışık sayılar, ilk/son, seri açıklığı.
- **Kısa dönem:** Son sekiz çekiliş ve üst üste çıkma.

Her modül seçilen hedefin **öncesindeki** çekilişleri kullanır, sonuçları ve sayısal sıralamaları ayrı üretir. Hedefin gerçek sonucu yalnızca geçmiş testlerde **sonradan karşılaştırma** için kullanılır.

### Çalışma havuzları
- Her modülün havuzunu ayrı ayrı veya tek tıkla tümünü kaydet.
- Manuel matematik laboratuvarında kayıtlı havuzları aynı tarayıcı ve aynı alan adı üzerinden içe alır.
- Birleşim ve kesişim, kontrollü **aşamalı süzgeç** (kaynak havuzun aslına dokunmaz).
- Geçmişte son 10/20/50/100 çekilişte bağımsız analiz havuzlarıyla test.

### Kupon atölyesi
- İstediğiniz 1–100 adet altılı kupon için seçili analizleri birlikte değerlendirme.
- Kaydedilmiş kaynak havuzunu ve aşamalı filtre havuzunu seçebilme.
- Sıkı veya yumuşak havuz seçimi; her yeni denemede çeşitlendirilmiş kuponlar.
- Kupon çalışmalarını kaydetme ve CSV indirme.

### Sistemler Kulübü
Altı bağımsız **sabit analiz** sisteminin geçmiş çekilişlerde altılı tahminlerini karşılaştırır. Kendi analiz kombinasyonunuzla adlandırılmış yarışmacı da ekleyebilirsiniz. Kuralları açık ve sabit kombinasyonlar kullanılır.

### Kayıt ve yedek
Analizler, manuel havuzlar, kupon çalışmaları ve sistem yarışmaları tarayıcının `localStorage` alanında saklanır. **Tüm kayıtlarımı indir** ile JSON yedeği alın; gerektiğinde geri yükleyin. Bu yerel saklama yöntemi cihazlar arasında otomatik eşitleme sağlamaz.

### Kaynak doğruluğu
Kullanıcının sağladığı 1–975 Süper Loto arşivi `data/draws.txt` içinde korunur. Modüller LotoTürkiye'de anlatılan **kamuya açık analiz kavramlarını** temel alan **bağımsız uygulamalardır**; orijinal sitenin kapalı formüllerini, özel sistemlerini, içeriklerini ya da ticari markalarını kopyaladığını iddia etmez.

### İstatistik uyarısı
Süper Loto'nun eşit olasılıklı varsayımında hiçbir frekans, bekleme süresi, matriks veya geçmiş kupon başarısı gelecekteki altılıyı bilemez. Filtreler/puanlar analiz ve çalışma düzeni içindir; 4/5/6 bilme garantisi yoktur.

## Teknoloji
HTML + CSS + saf JavaScript (ES modules). Harici API, paket, izleme veya abonelik gerekmez. GitHub Pages üzerinde çalışır.

## GitHub Pages
Repo → **Settings → Pages → Build and deployment → GitHub Actions** seçin. `.github/workflows/deploy.yml` her `main` güncellemesinde yayımlama işini çalıştırır. İlk yayımlama tamamlanınca adres tipik olarak `https://ustarenovasyon.github.io/Loto-Tahmin/` olur. Canlı bağlantı ilk yayımlama öncesinde doğrulanmış değildir.

Yerel bilgisayarda açmak için (ES modülleri ve TXT yüklemesi nedeniyle doğrudan `file://` yerine) örneğin `python -m http.server 8000` veya `npx serve .` ile klasörü sunun.

## Test
`node --test tests/*.test.mjs`

## Otomatik sonuç güncelleme
`Update real draws and System Corner` iş akışı saatte bir ve elle çalıştırılabilir.
`scripts/update-draws.mjs`, yalnızca arşivdeki son sıradan sonraki yayımlanmış sonuçları alır;
Windows-1254/UTF-8 kaynak kodlamasını, altılıyı, tarihi ve yıl içi sırayı doğrular.
Eski kayıtlar değişmez; sonuç henüz yoksa sayı üretilmez. Kaynak bağlantı hataları iş akışını başarısız gösterir.
Yeni arşivle önce önceden kaydedilmiş tahminler değerlendirilir, ardından sonraki hedef hazırlanır.
Botun veri commit'i diğer iş akışlarını tetiklemeyeceğinden aynı iş akışı Pages yayımlamasını da yapar.
Eski hesap testleri 1–975 tarihsel kesitini kullanır; güncel arşiv ayrıca bütünlük testinden geçer.
