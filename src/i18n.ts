import { makeAutoObservable } from 'mobx'
import { PAGE_STRINGS } from './i18n.pages'

export type Lang = 'english' | 'spanish' | 'french' | 'german' | 'italian' | 'brazilian' | 'japanese' | 'koreana' | 'schinese' | 'russian' | 'turkish' | 'polish'

/** Language list shown in the header menu: [code, native name]. Codes follow the real store's ?l= values. */
export const LANGUAGES: [Lang, string][] = [
  ['schinese', '简体中文 (Simplified Chinese)'], ['japanese', '日本語 (Japanese)'], ['koreana', '한국어 (Korean)'], ['german', 'Deutsch (German)'],
  ['spanish', 'Español - España (Spanish - Spain)'], ['french', 'Français (French)'], ['italian', 'Italiano (Italian)'], ['polish', 'Polski (Polish)'],
  ['brazilian', 'Português - Brasil (Portuguese - Brazil)'], ['russian', 'Русский (Russian)'], ['turkish', 'Türkçe (Turkish)'], ['english', 'English'],
]

type Dict = Record<string, string>
const en: Dict = {
  'nav.store': 'Store', 'nav.library': 'Library', 'nav.community': 'Community', 'nav.about': 'About', 'nav.wishlist': 'Wishlist', 'nav.cart': 'Cart',
  'auth.login': 'login', 'auth.join': 'join', 'auth.upload': 'Upload a game', 'lang.label': 'language',
  'menu.browse': 'Browse', 'menu.reco': 'Recommendations', 'menu.cats': 'Categories', 'menu.hw': 'Hardware', 'menu.ways': 'Ways to Play', 'menu.special': 'Special Sections',
  'search.ph': 'Search the store',
  'home.featured': 'Featured & Recommended', 'home.gift': 'Send a Gift Card', 'home.discounts': 'Discounts & Events', 'home.seemore': 'See More',
  'home.free': 'Free to Play', 'home.newrel': 'Top New Releases', 'home.genre': 'Browse by genre',
  'game.addcart': 'Add to Cart', 'game.wish': 'Add to your wishlist', 'game.follow': 'Follow', 'game.ignore': 'Ignore', 'game.hub': 'Community Hub',
  'game.buy': 'Buy {title}', 'game.play': 'Play Game', 'game.banner': "You're not signed in!", 'game.bannersub': 'Sign in to reSteam to wishlist, follow, purchase and see recommendations',
  'game.signin': 'Sign in',
  'cart.title': 'Your Shopping Cart', 'cart.empty': 'Your cart is empty.', 'cart.continue': 'Continue Shopping', 'cart.pay': 'Continue to payment', 'cart.total': 'Estimated total',
  'wish.empty': 'Your wishlist is empty.', 'wish.title': "{name}'s wishlist",
  'user.profile': 'View my profile', 'user.signout': 'Sign out of account…', 'user.account': 'Account details', 'user.settings': 'Settings', 'user.downloads': 'Manage downloads',
}
export const STRINGS_CORE_ENGLISH = (): Dict => en
const T: Record<Lang, Dict> = {
  english: en,
  spanish: {
    'nav.store': 'Tienda', 'nav.library': 'Biblioteca', 'nav.community': 'Comunidad', 'nav.about': 'Acerca de', 'nav.wishlist': 'Lista de deseados', 'nav.cart': 'Carrito',
    'auth.login': 'iniciar sesión', 'auth.join': 'unirse', 'auth.upload': 'Subir un juego', 'lang.label': 'idioma',
    'menu.browse': 'Explorar', 'menu.reco': 'Recomendaciones', 'menu.cats': 'Categorías', 'menu.hw': 'Hardware', 'menu.ways': 'Formas de jugar', 'menu.special': 'Secciones especiales',
    'search.ph': 'Buscar en la tienda',
    'home.featured': 'Destacados y recomendados', 'home.gift': 'Enviar una tarjeta de regalo', 'home.discounts': 'Ofertas y eventos', 'home.seemore': 'Ver más',
    'home.free': 'Gratis para jugar', 'home.newrel': 'Mejores novedades', 'home.genre': 'Explorar por género',
    'game.addcart': 'Añadir al carrito', 'game.wish': 'Añadir a tu lista de deseados', 'game.follow': 'Seguir', 'game.ignore': 'Ignorar', 'game.hub': 'Centro de la comunidad',
    'game.buy': 'Comprar {title}', 'game.play': 'Jugar', 'game.banner': '¡No has iniciado sesión!', 'game.bannersub': 'Inicia sesión en reSteam para añadir a deseados, seguir, comprar y ver recomendaciones',
    'game.signin': 'Iniciar sesión',
    'cart.title': 'Tu carrito de la compra', 'cart.empty': 'Tu carrito está vacío.', 'cart.continue': 'Seguir comprando', 'cart.pay': 'Continuar con el pago', 'cart.total': 'Total estimado',
    'wish.empty': 'Tu lista de deseados está vacía.', 'wish.title': 'Lista de deseados de {name}',
    'user.profile': 'Ver mi perfil', 'user.signout': 'Cerrar sesión de la cuenta…', 'user.account': 'Detalles de la cuenta', 'user.settings': 'Ajustes', 'user.downloads': 'Gestionar descargas',
  },
  french: {
    'nav.store': 'Boutique', 'nav.library': 'Bibliothèque', 'nav.community': 'Communauté', 'nav.about': 'À propos', 'nav.wishlist': 'Liste de souhaits', 'nav.cart': 'Panier',
    'auth.login': 'connexion', 'auth.join': "s'inscrire", 'auth.upload': 'Publier un jeu', 'lang.label': 'langue',
    'menu.browse': 'Parcourir', 'menu.reco': 'Recommandations', 'menu.cats': 'Catégories', 'menu.hw': 'Matériel', 'menu.ways': 'Façons de jouer', 'menu.special': 'Sections spéciales',
    'search.ph': 'Rechercher dans la boutique',
    'home.featured': 'À la une et recommandés', 'home.gift': 'Envoyer une carte cadeau', 'home.discounts': 'Promotions et événements', 'home.seemore': 'Voir plus',
    'home.free': 'Jouer gratuitement', 'home.newrel': 'Meilleures nouveautés', 'home.genre': 'Parcourir par genre',
    'game.addcart': 'Ajouter au panier', 'game.wish': 'Ajouter à votre liste de souhaits', 'game.follow': 'Suivre', 'game.ignore': 'Ignorer', 'game.hub': 'Hub de la communauté',
    'game.buy': 'Acheter {title}', 'game.play': 'Jouer', 'game.banner': "Vous n'êtes pas connecté !", 'game.bannersub': 'Connectez-vous à reSteam pour ajouter à vos souhaits, suivre, acheter et voir des recommandations',
    'game.signin': 'Se connecter',
    'cart.title': 'Votre panier', 'cart.empty': 'Votre panier est vide.', 'cart.continue': 'Poursuivre vos achats', 'cart.pay': 'Passer au paiement', 'cart.total': 'Total estimé',
    'wish.empty': 'Votre liste de souhaits est vide.', 'wish.title': 'Liste de souhaits de {name}',
    'user.profile': 'Voir mon profil', 'user.signout': 'Se déconnecter du compte…', 'user.account': 'Détails du compte', 'user.settings': 'Paramètres', 'user.downloads': 'Gérer les téléchargements',
  },
  german: {
    'nav.store': 'Shop', 'nav.library': 'Bibliothek', 'nav.community': 'Community', 'nav.about': 'Über', 'nav.wishlist': 'Wunschliste', 'nav.cart': 'Warenkorb',
    'auth.login': 'anmelden', 'auth.join': 'registrieren', 'auth.upload': 'Spiel hochladen', 'lang.label': 'Sprache',
    'menu.browse': 'Stöbern', 'menu.reco': 'Empfehlungen', 'menu.cats': 'Kategorien', 'menu.hw': 'Hardware', 'menu.ways': 'Spielweisen', 'menu.special': 'Sonderbereiche',
    'search.ph': 'Im Shop suchen',
    'home.featured': 'Empfohlen & Beliebt', 'home.gift': 'Geschenkkarte senden', 'home.discounts': 'Angebote & Events', 'home.seemore': 'Mehr anzeigen',
    'home.free': 'Kostenlos spielen', 'home.newrel': 'Beliebte Neuerscheinungen', 'home.genre': 'Nach Genre stöbern',
    'game.addcart': 'In den Warenkorb', 'game.wish': 'Auf die Wunschliste', 'game.follow': 'Folgen', 'game.ignore': 'Ignorieren', 'game.hub': 'Community-Hub',
    'game.buy': '{title} kaufen', 'game.play': 'Spiel starten', 'game.banner': 'Du bist nicht angemeldet!', 'game.bannersub': 'Melde dich bei reSteam an, um zu wünschen, zu folgen, zu kaufen und Empfehlungen zu sehen',
    'game.signin': 'Anmelden',
    'cart.title': 'Dein Warenkorb', 'cart.empty': 'Dein Warenkorb ist leer.', 'cart.continue': 'Weiter einkaufen', 'cart.pay': 'Weiter zur Zahlung', 'cart.total': 'Geschätzte Summe',
    'wish.empty': 'Deine Wunschliste ist leer.', 'wish.title': 'Wunschliste von {name}',
    'user.profile': 'Mein Profil ansehen', 'user.signout': 'Vom Konto abmelden…', 'user.account': 'Kontodetails', 'user.settings': 'Einstellungen', 'user.downloads': 'Downloads verwalten',
  },
  italian: {
    'nav.store': 'Negozio', 'nav.library': 'Libreria', 'nav.community': 'Community', 'nav.about': 'Info', 'nav.wishlist': 'Lista desideri', 'nav.cart': 'Carrello',
    'auth.login': 'accedi', 'auth.join': 'iscriviti', 'auth.upload': 'Carica un gioco', 'lang.label': 'lingua',
    'menu.browse': 'Sfoglia', 'menu.reco': 'Consigli', 'menu.cats': 'Categorie', 'menu.hw': 'Hardware', 'menu.ways': 'Modi di giocare', 'menu.special': 'Sezioni speciali',
    'search.ph': 'Cerca nel negozio',
    'home.featured': 'In evidenza e consigliati', 'home.gift': 'Invia una carta regalo', 'home.discounts': 'Offerte ed eventi', 'home.seemore': 'Mostra altro',
    'home.free': 'Gratis da giocare', 'home.newrel': 'Migliori novità', 'home.genre': 'Sfoglia per genere',
    'game.addcart': 'Aggiungi al carrello', 'game.wish': 'Aggiungi alla lista desideri', 'game.follow': 'Segui', 'game.ignore': 'Ignora', 'game.hub': 'Hub della community',
    'game.buy': 'Acquista {title}', 'game.play': 'Gioca', 'game.banner': 'Non hai effettuato l\'accesso!', 'game.bannersub': 'Accedi a reSteam per aggiungere ai desideri, seguire, acquistare e vedere i consigli',
    'game.signin': 'Accedi',
    'cart.title': 'Il tuo carrello', 'cart.empty': 'Il tuo carrello è vuoto.', 'cart.continue': 'Continua lo shopping', 'cart.pay': 'Continua con il pagamento', 'cart.total': 'Totale stimato',
    'wish.empty': 'La tua lista desideri è vuota.', 'wish.title': 'Lista desideri di {name}',
    'user.profile': 'Visualizza il mio profilo', 'user.signout': 'Esci dall\'account…', 'user.account': 'Dettagli account', 'user.settings': 'Impostazioni', 'user.downloads': 'Gestisci download',
  },
  brazilian: {
    'nav.store': 'Loja', 'nav.library': 'Biblioteca', 'nav.community': 'Comunidade', 'nav.about': 'Sobre', 'nav.wishlist': 'Lista de desejos', 'nav.cart': 'Carrinho',
    'auth.login': 'entrar', 'auth.join': 'cadastrar', 'auth.upload': 'Enviar um jogo', 'lang.label': 'idioma',
    'menu.browse': 'Explorar', 'menu.reco': 'Recomendações', 'menu.cats': 'Categorias', 'menu.hw': 'Hardware', 'menu.ways': 'Modos de jogar', 'menu.special': 'Seções especiais',
    'search.ph': 'Pesquisar na loja',
    'home.featured': 'Destaques e recomendados', 'home.gift': 'Enviar um cartão-presente', 'home.discounts': 'Ofertas e eventos', 'home.seemore': 'Ver mais',
    'home.free': 'Jogue de graça', 'home.newrel': 'Melhores lançamentos', 'home.genre': 'Explorar por gênero',
    'game.addcart': 'Adicionar ao carrinho', 'game.wish': 'Adicionar à lista de desejos', 'game.follow': 'Seguir', 'game.ignore': 'Ignorar', 'game.hub': 'Central da Comunidade',
    'game.buy': 'Comprar {title}', 'game.play': 'Jogar', 'game.banner': 'Você não está conectado!', 'game.bannersub': 'Entre no reSteam para adicionar à lista de desejos, seguir, comprar e ver recomendações',
    'game.signin': 'Entrar',
    'cart.title': 'Seu carrinho de compras', 'cart.empty': 'Seu carrinho está vazio.', 'cart.continue': 'Continuar comprando', 'cart.pay': 'Continuar para o pagamento', 'cart.total': 'Total estimado',
    'wish.empty': 'Sua lista de desejos está vazia.', 'wish.title': 'Lista de desejos de {name}',
    'user.profile': 'Ver meu perfil', 'user.signout': 'Sair da conta…', 'user.account': 'Detalhes da conta', 'user.settings': 'Configurações', 'user.downloads': 'Gerenciar downloads',
  },
  japanese: {
    'nav.store': 'ストア', 'nav.library': 'ライブラリ', 'nav.community': 'コミュニティ', 'nav.about': '概要', 'nav.wishlist': 'ウィッシュリスト', 'nav.cart': 'カート',
    'auth.login': 'ログイン', 'auth.join': '登録', 'auth.upload': 'ゲームを投稿', 'lang.label': '言語',
    'menu.browse': '見る', 'menu.reco': 'おすすめ', 'menu.cats': 'カテゴリ', 'menu.hw': 'ハードウェア', 'menu.ways': '遊び方', 'menu.special': '特集',
    'search.ph': 'ストアを検索',
    'home.featured': '注目のおすすめ', 'home.gift': 'ギフトカードを贈る', 'home.discounts': 'セールとイベント', 'home.seemore': 'もっと見る',
    'home.free': '基本プレイ無料', 'home.newrel': '人気の新作', 'home.genre': 'ジャンルで探す',
    'game.addcart': 'カートに入れる', 'game.wish': 'ウィッシュリストに追加', 'game.follow': 'フォロー', 'game.ignore': '無視', 'game.hub': 'コミュニティハブ',
    'game.buy': '{title}を購入', 'game.play': 'プレイ', 'game.banner': 'ログインしていません！', 'game.bannersub': 'reSteamにログインすると、ウィッシュリスト、フォロー、購入、おすすめの表示ができます',
    'game.signin': 'ログイン',
    'cart.title': 'ショッピングカート', 'cart.empty': 'カートは空です。', 'cart.continue': '買い物を続ける', 'cart.pay': '支払いに進む', 'cart.total': '合計（見込み）',
    'wish.empty': 'ウィッシュリストは空です。', 'wish.title': '{name}のウィッシュリスト',
    'user.profile': 'プロフィールを表示', 'user.signout': 'アカウントからログアウト…', 'user.account': 'アカウントの詳細', 'user.settings': '設定', 'user.downloads': 'ダウンロードを管理',
  },
  koreana: {
    'nav.store': '상점', 'nav.library': '라이브러리', 'nav.community': '커뮤니티', 'nav.about': '소개', 'nav.wishlist': '위시리스트', 'nav.cart': '장바구니',
    'auth.login': '로그인', 'auth.join': '가입', 'auth.upload': '게임 올리기', 'lang.label': '언어',
    'menu.browse': '둘러보기', 'menu.reco': '추천', 'menu.cats': '카테고리', 'menu.hw': '하드웨어', 'menu.ways': '플레이 방식', 'menu.special': '특별 섹션',
    'search.ph': '상점 검색',
    'home.featured': '추천 및 인기 게임', 'home.gift': '기프트 카드 보내기', 'home.discounts': '할인 및 이벤트', 'home.seemore': '더 보기',
    'home.free': '무료 플레이', 'home.newrel': '인기 신작', 'home.genre': '장르별 둘러보기',
    'game.addcart': '장바구니에 담기', 'game.wish': '위시리스트에 추가', 'game.follow': '팔로우', 'game.ignore': '무시', 'game.hub': '커뮤니티 허브',
    'game.buy': '{title} 구매', 'game.play': '플레이', 'game.banner': '로그인하지 않았습니다!', 'game.bannersub': 'reSteam에 로그인하여 위시리스트, 팔로우, 구매 및 추천을 이용하세요',
    'game.signin': '로그인',
    'cart.title': '장바구니', 'cart.empty': '장바구니가 비어 있습니다.', 'cart.continue': '쇼핑 계속하기', 'cart.pay': '결제 진행', 'cart.total': '예상 합계',
    'wish.empty': '위시리스트가 비어 있습니다.', 'wish.title': '{name}의 위시리스트',
    'user.profile': '내 프로필 보기', 'user.signout': '계정에서 로그아웃…', 'user.account': '계정 정보', 'user.settings': '설정', 'user.downloads': '다운로드 관리',
  },
  schinese: {
    'nav.store': '商店', 'nav.library': '库', 'nav.community': '社区', 'nav.about': '关于', 'nav.wishlist': '愿望单', 'nav.cart': '购物车',
    'auth.login': '登录', 'auth.join': '注册', 'auth.upload': '上传游戏', 'lang.label': '语言',
    'menu.browse': '浏览', 'menu.reco': '推荐', 'menu.cats': '分类', 'menu.hw': '硬件', 'menu.ways': '游玩方式', 'menu.special': '特色专区',
    'search.ph': '搜索商店',
    'home.featured': '精选和推荐', 'home.gift': '发送礼品卡', 'home.discounts': '优惠与活动', 'home.seemore': '查看更多',
    'home.free': '免费游玩', 'home.newrel': '热门新品', 'home.genre': '按类型浏览',
    'game.addcart': '添加至购物车', 'game.wish': '添加至您的愿望单', 'game.follow': '关注', 'game.ignore': '忽略', 'game.hub': '社区中心',
    'game.buy': '购买 {title}', 'game.play': '开始游戏', 'game.banner': '您尚未登录！', 'game.bannersub': '登录 reSteam 即可添加愿望单、关注、购买并查看推荐',
    'game.signin': '登录',
    'cart.title': '您的购物车', 'cart.empty': '您的购物车是空的。', 'cart.continue': '继续购物', 'cart.pay': '继续付款', 'cart.total': '预计总额',
    'wish.empty': '您的愿望单是空的。', 'wish.title': '{name}的愿望单',
    'user.profile': '查看我的个人资料', 'user.signout': '退出账户…', 'user.account': '账户明细', 'user.settings': '设置', 'user.downloads': '管理下载',
  },
  russian: {
    'nav.store': 'Магазин', 'nav.library': 'Библиотека', 'nav.community': 'Сообщество', 'nav.about': 'О проекте', 'nav.wishlist': 'Список желаемого', 'nav.cart': 'Корзина',
    'auth.login': 'войти', 'auth.join': 'регистрация', 'auth.upload': 'Загрузить игру', 'lang.label': 'язык',
    'menu.browse': 'Обзор', 'menu.reco': 'Рекомендации', 'menu.cats': 'Категории', 'menu.hw': 'Оборудование', 'menu.ways': 'Способы игры', 'menu.special': 'Особые разделы',
    'search.ph': 'Поиск по магазину',
    'home.featured': 'Рекомендуемое и популярное', 'home.gift': 'Отправить подарочную карту', 'home.discounts': 'Скидки и события', 'home.seemore': 'Ещё',
    'home.free': 'Бесплатные игры', 'home.newrel': 'Популярные новинки', 'home.genre': 'Обзор по жанрам',
    'game.addcart': 'В корзину', 'game.wish': 'В список желаемого', 'game.follow': 'Следить', 'game.ignore': 'Игнорировать', 'game.hub': 'Центр сообщества',
    'game.buy': 'Купить {title}', 'game.play': 'Играть', 'game.banner': 'Вы не вошли в аккаунт!', 'game.bannersub': 'Войдите в reSteam, чтобы добавлять в список желаемого, следить, покупать и получать рекомендации',
    'game.signin': 'Войти',
    'cart.title': 'Ваша корзина', 'cart.empty': 'Ваша корзина пуста.', 'cart.continue': 'Продолжить покупки', 'cart.pay': 'Перейти к оплате', 'cart.total': 'Предварительный итог',
    'wish.empty': 'Ваш список желаемого пуст.', 'wish.title': 'Список желаемого: {name}',
    'user.profile': 'Мой профиль', 'user.signout': 'Выйти из аккаунта…', 'user.account': 'Данные аккаунта', 'user.settings': 'Настройки', 'user.downloads': 'Управление загрузками',
  },
  turkish: {
    'nav.store': 'Mağaza', 'nav.library': 'Kütüphane', 'nav.community': 'Topluluk', 'nav.about': 'Hakkında', 'nav.wishlist': 'İstek Listesi', 'nav.cart': 'Sepet',
    'auth.login': 'giriş yap', 'auth.join': 'kayıt ol', 'auth.upload': 'Oyun yükle', 'lang.label': 'dil',
    'menu.browse': 'Göz At', 'menu.reco': 'Öneriler', 'menu.cats': 'Kategoriler', 'menu.hw': 'Donanım', 'menu.ways': 'Oynama Yolları', 'menu.special': 'Özel Bölümler',
    'search.ph': 'Mağazada ara',
    'home.featured': 'Öne Çıkanlar ve Önerilenler', 'home.gift': 'Hediye Kartı Gönder', 'home.discounts': 'İndirimler ve Etkinlikler', 'home.seemore': 'Daha Fazla',
    'home.free': 'Ücretsiz Oyna', 'home.newrel': 'En İyi Yeni Çıkanlar', 'home.genre': 'Türe göre göz at',
    'game.addcart': 'Sepete Ekle', 'game.wish': 'İstek listene ekle', 'game.follow': 'Takip Et', 'game.ignore': 'Yoksay', 'game.hub': 'Topluluk Merkezi',
    'game.buy': '{title} satın al', 'game.play': 'Oyna', 'game.banner': 'Giriş yapmadın!', 'game.bannersub': 'İstek listesi, takip, satın alma ve öneriler için reSteam\'e giriş yap',
    'game.signin': 'Giriş yap',
    'cart.title': 'Alışveriş Sepetin', 'cart.empty': 'Sepetin boş.', 'cart.continue': 'Alışverişe Devam Et', 'cart.pay': 'Ödemeye devam et', 'cart.total': 'Tahmini toplam',
    'wish.empty': 'İstek listen boş.', 'wish.title': '{name} kullanıcısının istek listesi',
    'user.profile': 'Profilimi görüntüle', 'user.signout': 'Hesaptan çıkış yap…', 'user.account': 'Hesap ayrıntıları', 'user.settings': 'Ayarlar', 'user.downloads': 'İndirmeleri yönet',
  },
  polish: {
    'nav.store': 'Sklep', 'nav.library': 'Biblioteka', 'nav.community': 'Społeczność', 'nav.about': 'Informacje', 'nav.wishlist': 'Lista życzeń', 'nav.cart': 'Koszyk',
    'auth.login': 'zaloguj się', 'auth.join': 'zarejestruj się', 'auth.upload': 'Dodaj grę', 'lang.label': 'język',
    'menu.browse': 'Przeglądaj', 'menu.reco': 'Rekomendacje', 'menu.cats': 'Kategorie', 'menu.hw': 'Sprzęt', 'menu.ways': 'Sposoby gry', 'menu.special': 'Sekcje specjalne',
    'search.ph': 'Przeszukaj sklep',
    'home.featured': 'Polecane i rekomendowane', 'home.gift': 'Wyślij kartę podarunkową', 'home.discounts': 'Promocje i wydarzenia', 'home.seemore': 'Zobacz więcej',
    'home.free': 'Darmowe gry', 'home.newrel': 'Najlepsze nowości', 'home.genre': 'Przeglądaj wg gatunku',
    'game.addcart': 'Dodaj do koszyka', 'game.wish': 'Dodaj do listy życzeń', 'game.follow': 'Obserwuj', 'game.ignore': 'Ignoruj', 'game.hub': 'Centrum społeczności',
    'game.buy': 'Kup {title}', 'game.play': 'Graj', 'game.banner': 'Nie jesteś zalogowany!', 'game.bannersub': 'Zaloguj się do reSteam, aby dodawać do listy życzeń, obserwować, kupować i zobaczyć rekomendacje',
    'game.signin': 'Zaloguj się',
    'cart.title': 'Twój koszyk', 'cart.empty': 'Twój koszyk jest pusty.', 'cart.continue': 'Kontynuuj zakupy', 'cart.pay': 'Przejdź do płatności', 'cart.total': 'Szacowana suma',
    'wish.empty': 'Twoja lista życzeń jest pusta.', 'wish.title': 'Lista życzeń: {name}',
    'user.profile': 'Zobacz mój profil', 'user.signout': 'Wyloguj się z konta…', 'user.account': 'Szczegóły konta', 'user.settings': 'Ustawienia', 'user.downloads': 'Zarządzaj pobieraniem',
  },
}

export const STRINGS_CORE = (): Record<Lang, Dict> => T
const KEY = 'resteam:lang'
const detect = (): Lang => {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null
    if (saved && saved in T) return saved
    const n = navigator.language.toLowerCase()
    const map: [string, Lang][] = [['es', 'spanish'], ['fr', 'french'], ['de', 'german'], ['it', 'italian'], ['pt', 'brazilian'], ['ja', 'japanese'], ['ko', 'koreana'], ['zh', 'schinese'], ['ru', 'russian'], ['tr', 'turkish'], ['pl', 'polish']]
    return map.find(([p]) => n.startsWith(p))?.[1] ?? 'english'
  } catch { return 'english' }
}

class I18n {
  lang: Lang = detect()
  constructor() { makeAutoObservable(this) }
  set(l: Lang) {
    this.lang = l
    try { localStorage.setItem(KEY, l) } catch { /* storage unavailable */ }
    const html: Record<Lang, string> = { english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it', brazilian: 'pt-BR', japanese: 'ja', koreana: 'ko', schinese: 'zh-CN', russian: 'ru', turkish: 'tr', polish: 'pl' }
    document.documentElement.lang = html[l]
  }
}
export const i18n = new I18n()
if (typeof document !== 'undefined') document.documentElement.lang = ({ english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it', brazilian: 'pt-BR', japanese: 'ja', koreana: 'ko', schinese: 'zh-CN', russian: 'ru', turkish: 'tr', polish: 'pl' } as Record<Lang, string>)[i18n.lang]

/** Translates a key (falling back to English) and fills {placeholders}. Reading i18n.lang makes observers re-render on change. */
export const t = (key: string, vars?: Record<string, string>): string => {
  let s = T[i18n.lang][key] ?? PAGE_STRINGS[i18n.lang]?.[key] ?? en[key] ?? PAGE_STRINGS.english[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v)
  return s
}
