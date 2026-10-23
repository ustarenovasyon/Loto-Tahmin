# Loto Tahmin — Strateji Laboratuvarı

Kullanıcının sağladığı **975 gerçek Süper Loto çekilişi** üzerinde çalışan, telefona uygun ve tamamen statik web uygulaması.

## Kullanım
- `index.html` web sayfasını açın veya GitHub Pages ile `main / (root)` klasörünü yayımlayın.
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

## Teknoloji
HTML + CSS + saf JavaScript (ES modules). Harici API, paket, izleme veya abonelik gerekmez. GitHub Pages üzerinde çalışır.

## GitHub Pages
Repo → Settings → Pages → **Deploy from a branch** → `main` / `/(root)` → Save.

## Test
`node --test tests/engine.test.mjs`
