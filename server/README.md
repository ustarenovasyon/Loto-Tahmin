# Gerçek sohbet modeli bağlantısı
Ana sayfada yerel komut modu hemen çalışır. Bu mod bir dil modeli değildir.
Serbest sohbetin analiz komutlarına çevrilmesi için bu Node 22 servisi hazırlanmıştır;
şu anda bir sunucuya dağıtılmamış, model çağrısı gerçek hesapla doğrulanmamıştır.

Sunucuda secret/environment olarak yapılandır:
- OPENAI_API_KEY: sağlayıcı anahtarı (asla tarayıcıya veya repoya yazma)
- OPENAI_MODEL: hesabında etkin Responses + Structured Outputs destekli model kimliği
- ASSISTANT_ACCESS_TOKEN: uzun rastgele servis erişim kodu
- ASSISTANT_ALLOWED_ORIGIN: https://ustarenovasyon.github.io
- PORT: varsayılan 8787

`node server/assistant-server.mjs` başlatılır; HTTPS ters vekil ile yalnız /interpret
sunulur. GitHub Pages bu sunucu kodunu çalıştıramaz. Servis URL'sini ana sayfadaki
Asistan bağlantısı ayarına, servis erişim kodunu oturum alanına yaz. Erişim kodu
kalıcı saklanmaz; model anahtarı yalnız sunucuda bulunur. Üçüncü kişilere erişim kodu
vermek model kullanım ücretine erişim verir. Sunucu kodu basit tek süreç limiti
(6 istek/dakika/IP) uygular; genel erişimden önce kimlik doğrulama ve kalıcı kota eklenmelidir.

Model yalnız yapılandırılmış bir işlem komutu üretir. Geçmiş sonuçlar, sıralamalar,
havuzlar ve kolonlar mevcut analiz motorunda hesaplanır. Model bağlantısı başarısızsa
sessizce sahte sohbet cevabına dönülmez; hata görünür.
