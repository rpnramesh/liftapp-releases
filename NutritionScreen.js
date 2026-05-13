// NutritionScreen.js — South Indian & Indian Nutrition Facts
// Data: IFCT 2017 (NIN/ICMR) + USDA FoodData Central
// Format per food: compact pipe-delimited, parsed at runtime
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Modal, FlatList, StyleSheet, Dimensions, Animated,
  SafeAreaView, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette, makeStyles, useTheme } from './LIFT_PROJECT/theme/ThemeProvider';

const { width } = Dimensions.get('window');

// ── Categories ─────────────────────────────────────────────────────────────────
export const NUTRITION_CATEGORIES = [
  { key: 'All',         label: 'All',            emoji: '🍽️' },
  { key: 'Breakfast',   label: 'Breakfast',       emoji: '🌅' },
  { key: 'Rice',        label: 'Rice Dishes',     emoji: '🍚' },
  { key: 'Curry',       label: 'Curries',         emoji: '🍛' },
  { key: 'Dal',         label: 'Dal & Lentils',   emoji: '🫘' },
  { key: 'Snacks',      label: 'Snacks',          emoji: '🥜' },
  { key: 'Sweets',      label: 'Sweets',          emoji: '🍮' },
  { key: 'Breads',      label: 'Breads',          emoji: '🫓' },
  { key: 'Seafood',     label: 'Seafood',         emoji: '🐟' },
  { key: 'Meat',        label: 'Meat & Poultry',  emoji: '🍗' },
  { key: 'Vegetables',  label: 'Vegetables',      emoji: '🥦' },
  { key: 'Fruits',      label: 'Fruits',          emoji: '🍌' },
  { key: 'Beverages',   label: 'Beverages',       emoji: '☕' },
  { key: 'Dairy',       label: 'Dairy',           emoji: '🥛' },
  { key: 'Condiments',  label: 'Chutneys & More', emoji: '🫙' },
];

// ── Food Database ──────────────────────────────────────────────────────────────
// Fields: id|name|emoji|category|calories|protein|carbs|fat|fibre|sodium|serving|description|tags
// Values: per standard serving. Source: IFCT 2017 (NIN/ICMR), USDA FoodData Central.
const FOODS_RAW = `
idli|Idli|🫓|Breakfast|116|3.6|23.2|0.4|0.8|156|2 pcs (100g)|Steamed fermented rice cake, light & digestible|vegan,gluten-free
dosa|Dosa|🥞|Breakfast|133|3.3|22.3|3.7|0.9|190|1 piece (80g)|Crispy fermented rice & lentil crepe|vegan
medu_vada|Medu Vada|🍩|Breakfast|222|8.4|22.9|11.8|2.1|380|2 pcs (80g)|Crispy deep-fried lentil doughnut|vegan
uttapam|Uttapam|🫔|Breakfast|107|3.5|17.8|2.7|1.1|165|1 piece (100g)|Thick soft rice pancake with toppings|vegan
appam|Appam|🥞|Breakfast|126|2.8|25.6|1.5|0.6|180|2 pcs (100g)|Lacy rice pancake with crispy edges|vegan,gluten-free
puttu|Puttu|🫙|Breakfast|159|3.7|31.8|1.8|1.2|120|1 serving (150g)|Steamed cylindrical rice cake with coconut|vegan,gluten-free
idiyappam|Idiyappam|🍝|Breakfast|142|2.5|30.2|1.0|0.5|95|1 serving (100g)|Steamed rice noodle nest|vegan,gluten-free
upma|Upma|🍲|Breakfast|145|3.8|22.5|4.2|1.5|380|1 bowl (150g)|Semolina porridge tempered with mustard & curry leaves|vegan
ven_pongal|Ven Pongal|🍛|Breakfast|148|4.2|23.8|4.8|1.3|290|1 bowl (150g)|Rice & moong dal cooked with ghee, ginger & pepper|vegetarian
rava_dosa|Rava Dosa|🥞|Breakfast|157|3.5|22.8|5.8|0.8|210|1 piece (80g)|Crispy thin crepe made from semolina & rice flour|vegan
pesarattu|Pesarattu|🥞|Breakfast|155|8.5|22.1|3.8|2.2|185|2 pcs (100g)|Green moong dal crepe, Andhra style|vegan,gluten-free
poha|Poha|🍚|Breakfast|130|2.8|26.5|1.8|1.4|350|1 bowl (150g)|Flattened rice with turmeric, mustard & curry leaves|vegan,gluten-free
set_dosa|Set Dosa|🥞|Breakfast|120|3.5|20.8|2.6|1.0|175|3 pcs (120g)|Soft spongy thick dosas served in a set of 3|vegan
neer_dosa|Neer Dosa|🥞|Breakfast|95|2.1|19.2|1.2|0.4|130|2 pcs (80g)|Thin delicate rice crepe from coastal Karnataka|vegan,gluten-free
akki_roti|Akki Roti|🫓|Breakfast|220|4.2|40.5|4.8|1.8|280|1 piece (100g)|Rice flour flatbread with vegetables & coconut|vegan,gluten-free
thatte_idli|Thatte Idli|🫓|Breakfast|120|3.8|23.5|0.5|0.9|160|1 piece (100g)|Large flat steamed idli from Bidadi|vegan,gluten-free
kuzhi_paniyaram|Kuzhi Paniyaram|🍡|Breakfast|168|4.2|26.5|5.1|1.1|200|6 pcs (100g)|Ball-shaped dumplings in a special pan|vegan
sevai|Sevai (Rice Noodles)|🍝|Breakfast|138|2.8|28.5|1.2|0.6|110|1 serving (100g)|Pressed rice noodles, steamed|vegan,gluten-free
wheat_dosa|Wheat Dosa|🥞|Breakfast|118|3.9|20.5|2.8|1.6|190|1 piece (80g)|Quick dosa made from wheat flour|vegan
kothu_parotta|Kothu Parotta|🍛|Breakfast|210|6.5|32.5|6.8|1.9|420|1 serving (150g)|Shredded parotta stir-fried with eggs & masala|vegetarian
steamed_rice|Steamed White Rice|🍚|Rice|130|2.7|28.2|0.3|0.4|5|1 cup (180g)|Plain cooked white rice, South Indian staple|vegan,gluten-free
kerala_red_rice|Kerala Red Rice (cooked)|🍚|Rice|121|2.9|25.8|0.5|0.8|4|1 cup (180g)|Nutritious red/rosematta rice, nutty flavour|vegan,gluten-free
sambar_rice|Sambar Rice|🍛|Rice|152|5.8|28.5|2.1|1.8|380|1 plate (250g)|Steamed rice mixed with sambar, comfort food|vegan
curd_rice|Curd Rice|🍚|Rice|136|4.5|22.8|3.2|0.4|290|1 bowl (200g)|Rice mixed with curd, tempered with mustard & curry leaves|vegetarian,gluten-free
tamarind_rice|Tamarind Rice (Puliyodarai)|🍚|Rice|195|3.2|35.8|5.8|1.5|520|1 plate (200g)|Tangy rice with tamarind, peanuts & spices|vegan,gluten-free
lemon_rice|Lemon Rice|🍚|Rice|185|3.2|33.8|5.4|1.2|380|1 plate (200g)|Zesty turmeric rice with lemon & peanuts|vegan,gluten-free
coconut_rice|Coconut Rice (Thengai Sadam)|🍚|Rice|215|3.1|33.5|8.2|1.6|290|1 plate (200g)|Fragrant rice with grated coconut & tempering|vegan,gluten-free
bisi_bele_bath|Bisi Bele Bath|🍛|Rice|165|6.2|28.5|4.1|2.8|480|1 bowl (250g)|Karnataka one-pot rice with dal & vegetables|vegan
tomato_rice|Tomato Rice|🍚|Rice|175|3.8|32.5|4.2|1.5|420|1 plate (200g)|Tangy tomato-flavoured rice with South Indian spices|vegan,gluten-free
ghee_rice|Ghee Rice|🍚|Rice|248|3.5|37.8|9.5|0.5|380|1 plate (200g)|Fragrant Malabar-style rice cooked with ghee & spices|vegetarian,gluten-free
vangi_bath|Vangi Bath|🍛|Rice|180|4.1|32.2|4.8|2.2|420|1 plate (200g)|Eggplant rice, Karnataka specialty with special masala|vegan
malabar_biriyani|Malabar Biriyani|🍛|Rice|285|14.5|38.2|7.8|1.8|580|1 plate (300g)|Fragrant Malabar-style chicken biryani|non-veg
veg_biriyani|Veg Dum Biriyani|🍛|Rice|235|5.8|40.5|6.2|2.5|520|1 plate (280g)|Aromatic basmati rice layered with vegetables|vegetarian
pongal_rice|Pongal (Sweet)|🍛|Rice|185|3.5|35.5|4.2|0.8|45|1 bowl (200g)|Sweet Sankranti rice with jaggery & dal|vegetarian,gluten-free
jeera_rice|Jeera Rice|🍚|Rice|210|3.8|38.5|5.2|0.6|320|1 plate (200g)|Cumin-flavoured basmati rice|vegan,gluten-free
sambar|Sambar|🍲|Curry|52|2.8|8.5|1.2|2.5|480|1 cup (200ml)|Tangy lentil vegetable stew with tamarind|vegan,gluten-free
rasam|Rasam|🍵|Curry|28|1.5|4.2|0.8|0.8|380|1 cup (200ml)|Thin spiced tamarind & tomato soup|vegan,gluten-free
avial|Avial|🥘|Curry|135|2.8|12.5|8.2|3.5|280|1 bowl (150g)|Mixed vegetables in coconut & curd gravy|vegetarian,gluten-free
kerala_fish_curry|Kerala Fish Curry|🐟|Curry|118|15.5|3.2|5.8|0.5|620|1 serving (150g)|Spicy Malabar fish curry in coconut & kodampuli|non-veg,gluten-free
kerala_chicken_curry|Kerala Chicken Curry|🍗|Curry|185|18.5|4.2|10.5|0.8|580|1 serving (150g)|Spicy chicken curry with roasted coconut masala|non-veg,gluten-free
egg_curry|Egg Curry|🥚|Curry|158|12.5|4.8|10.5|0.8|480|2 eggs in gravy (180g)|Hard-boiled eggs in spiced onion-tomato gravy|vegetarian,gluten-free
prawn_masala|Prawn Masala|🍤|Curry|145|18.2|3.5|6.8|0.5|580|1 serving (150g)|Prawns cooked in South Indian spiced masala|non-veg,gluten-free
kootu|Kootu|🥘|Curry|88|4.2|12.5|2.8|3.8|320|1 bowl (150g)|Vegetable & lentil stir-cook with coconut|vegan,gluten-free
olan|Olan|🥘|Curry|65|2.5|8.5|2.8|2.5|280|1 bowl (150g)|Kerala ash gourd & cowpea in coconut milk|vegan,gluten-free
thoran|Thoran (Cabbage)|🥬|Curry|55|2.5|6.5|2.8|2.8|180|1 bowl (100g)|Stir-fried shredded vegetable with coconut|vegan,gluten-free
moru_curry|Moru Curry (Curd Curry)|🍵|Curry|48|2.1|5.8|2.1|0.5|380|1 bowl (150ml)|Kerala yogurt curry with coconut & turmeric|vegetarian,gluten-free
poriyal|Poriyal|🥦|Curry|75|2.8|9.5|3.2|3.2|180|1 bowl (100g)|Tamil Nadu stir-fried vegetable with coconut|vegan,gluten-free
keerai_masiyal|Keerai Masiyal|🌿|Curry|42|3.5|4.5|1.5|2.8|280|1 bowl (150g)|Mashed spinach/greens with garlic & cumin|vegan,gluten-free
chicken_stew|Kerala Chicken Stew|🍗|Curry|125|14.5|6.5|4.5|1.2|420|1 serving (150g)|Mild coconut milk chicken stew with vegetables|non-veg,gluten-free
fish_molee|Fish Molee|🐟|Curry|145|16.5|4.5|6.8|0.5|480|1 serving (150g)|Mild Kerala fish curry in coconut milk|non-veg,gluten-free
erissery|Erissery (Pumpkin)|🎃|Curry|125|3.5|16.5|5.2|3.2|280|1 bowl (150g)|Kerala pumpkin & cowpea curry with coconut|vegan,gluten-free
theeyal|Theeyal|🥘|Curry|158|4.5|12.5|10.5|3.5|380|1 bowl (150g)|Roasted coconut curry with tamarind & shallots|vegan,gluten-free
pulissery|Pulissery|🍵|Curry|72|3.2|8.5|3.2|0.5|320|1 bowl (150ml)|Kerala sour curd curry with raw mango|vegetarian,gluten-free
chettinad_chicken|Chettinad Chicken Curry|🍗|Curry|195|20.5|5.2|10.8|1.2|620|1 serving (150g)|Aromatic spicy chicken with Chettinad spice blend|non-veg,gluten-free
mutton_curry|Mutton Curry|🥩|Curry|218|22.5|4.8|12.5|0.8|580|1 serving (150g)|South Indian style spiced mutton gravy|non-veg,gluten-free
toor_dal|Toor Dal (cooked)|🫘|Dal|104|6.5|18.2|0.8|4.5|320|1 bowl (150g)|Pigeon pea lentil, South Indian staple base for sambar|vegan,gluten-free
moong_dal|Moong Dal (cooked)|🫘|Dal|105|7.2|17.8|0.6|4.2|180|1 bowl (150g)|Split green gram, easily digestible protein source|vegan,gluten-free
masoor_dal|Masoor Dal (cooked)|🫘|Dal|115|9.0|17.5|0.5|5.5|280|1 bowl (150g)|Red lentil, quick cooking & nutritious|vegan,gluten-free
chana_dal|Chana Dal (cooked)|🫘|Dal|165|8.5|26.5|2.5|6.8|180|1 bowl (150g)|Split bengal gram, nutty flavour|vegan,gluten-free
urad_dal|Urad Dal (cooked)|🫘|Dal|108|7.5|18.0|0.5|3.8|180|1 bowl (150g)|Black gram dal, base for idli & dosa batter|vegan,gluten-free
dal_tadka|Dal Tadka|🍲|Dal|128|7.2|18.5|3.5|4.2|420|1 bowl (200g)|Lentils tempered with cumin, garlic & dried red chilli|vegan,gluten-free
kadala_curry|Kadala Curry (Black Chickpea)|🫘|Dal|165|8.5|26.5|3.5|6.8|380|1 bowl (150g)|Kerala black chickpea curry with coconut|vegan,gluten-free
rajma|Rajma (cooked)|🫘|Dal|148|9.5|22.5|2.5|6.5|280|1 bowl (150g)|Red kidney beans curry|vegan,gluten-free
lobia|Lobia (Cowpea) Curry|🫘|Dal|142|9.5|22.5|2.5|6.5|320|1 bowl (150g)|Black-eyed peas cooked in South Indian spices|vegan,gluten-free
paruppu_rasam|Paruppu Rasam|🍵|Dal|42|2.5|5.5|1.5|1.8|420|1 cup (200ml)|Thin tamarind soup with cooked toor dal|vegan,gluten-free
murukku|Murukku|🌀|Snacks|502|8.5|60.5|25.2|2.5|680|1 serving (50g)|Crispy deep-fried rice & lentil spiral snack|vegan
banana_chips|Banana Chips (Kerala)|🍌|Snacks|536|1.2|59.5|33.5|2.8|180|1 serving (50g)|Thin crispy banana slices fried in coconut oil|vegan,gluten-free
chakli|Chakli|🌀|Snacks|485|7.8|58.5|24.2|2.2|580|1 serving (50g)|Crispy spiral snack made from rice & lentil flour|vegan
ribbon_pakoda|Ribbon Pakoda|🎀|Snacks|495|8.2|57.8|25.8|1.8|620|1 serving (50g)|Flat ribbon-shaped deep-fried savoury snack|vegan
mixture|Mixture|🥜|Snacks|470|11.5|55.2|22.5|3.2|580|1 serving (50g)|South Indian savoury snack mix with sev & fried items|vegan
achappam|Achappam|🌸|Snacks|488|5.8|62.5|24.5|1.2|120|1 serving (50g)|Rose cookie, Kerala Christmas sweet-savoury snack|vegetarian
pazham_pori|Pazham Pori (Banana Fritter)|🍌|Snacks|195|1.8|28.5|8.5|1.8|180|2 pcs (80g)|Ripe banana dipped in batter & deep fried, Kerala style|vegan
sundal|Sundal (Chickpea)|🫘|Snacks|164|8.8|27.5|2.5|6.8|280|1 bowl (100g)|Boiled legumes tempered with coconut & curry leaves|vegan,gluten-free
masala_vada|Masala Vada|🍩|Snacks|268|10.5|28.5|13.5|4.5|480|2 pcs (80g)|Crispy chana dal fritter with onion & green chilli|vegan
samosa_veg|Veg Samosa|🔺|Snacks|252|5.2|33.5|11.5|2.5|480|2 pcs (80g)|Triangular pastry with spiced potato filling|vegan
bonda|Mysore Bonda|🟡|Snacks|218|6.5|25.8|10.5|2.2|420|2 pcs (80g)|Soft fluffy deep-fried urad dal dumplings|vegan
kara_sev|Kara Sev|🌿|Snacks|520|9.5|54.2|29.8|2.0|680|1 serving (50g)|Spicy deep-fried chickpea flour noodle snack|vegan
thattai|Thattai|💿|Snacks|475|7.8|57.5|23.5|2.2|580|1 serving (50g)|Flat crispy disc-shaped rice flour snack|vegan
nei_appam|Nei Appam|🟤|Snacks|248|3.2|38.5|9.5|0.8|80|4 pcs (80g)|Kerala sweet rice appam fried in ghee|vegetarian,gluten-free
rice_payasam|Rice Payasam|🍮|Sweets|178|3.5|28.5|5.8|0.4|85|1 bowl (150ml)|Creamy rice pudding with milk, jaggery & cardamom|vegetarian,gluten-free
semiya_payasam|Semiya Payasam|🍮|Sweets|172|3.8|27.5|5.5|0.5|95|1 bowl (150ml)|Vermicelli kheer with milk, sugar & cardamom|vegetarian
mysore_pak|Mysore Pak|🟡|Sweets|558|8.5|55.8|34.5|1.2|45|1 piece (50g)|Rich ghee & besan fudge from Mysore|vegetarian,gluten-free
carrot_halwa|Carrot Halwa|🥕|Sweets|248|3.2|32.5|12.8|2.5|85|1 serving (100g)|Slow-cooked carrot in milk, sugar & ghee|vegetarian,gluten-free
besan_ladoo|Besan Ladoo|🟡|Sweets|465|9.5|58.5|22.5|2.5|45|1 piece (50g)|Roasted chickpea flour ball with ghee & cardamom|vegetarian,gluten-free
jangiri|Jangiri (Jhangiri)|🌸|Sweets|395|5.5|82.5|5.2|0.5|45|1 serving (50g)|Deep-fried urad dal pretzel soaked in sugar syrup|vegan,gluten-free
gulab_jamun|Gulab Jamun|🟤|Sweets|310|5.5|55.2|8.5|0.4|180|2 pcs (80g)|Soft milk solid balls soaked in rose sugar syrup|vegetarian
paal_poli|Paal Poli|🥛|Sweets|285|7.8|45.2|8.5|0.8|120|1 serving (100g)|Fried flatbread soaked in sweetened milk|vegetarian
unniyappam|Unniyappam|🟤|Sweets|248|3.5|42.5|7.8|1.5|65|4 pcs (80g)|Small Kerala sweet rice & banana appam|vegan,gluten-free
ada_pradhaman|Ada Pradhaman|🍮|Sweets|195|3.5|32.5|6.5|0.8|65|1 bowl (150ml)|Kerala rice ada kheer with coconut milk & jaggery|vegan
kozhukattai|Kozhukattai|🫙|Sweets|165|2.8|32.5|3.2|0.8|95|2 pcs (80g)|Steamed rice dumpling with coconut-jaggery filling|vegan,gluten-free
chakka_varatti|Jackfruit Halwa|🟡|Sweets|285|1.5|58.5|7.5|2.5|45|1 serving (80g)|Concentrated jackfruit preserve with ghee & sugar|vegan,gluten-free
rava_kesari|Rava Kesari|🟠|Sweets|285|4.5|42.5|11.5|0.8|65|1 serving (100g)|Saffron semolina pudding with ghee & cashews|vegetarian
coconut_ladoo|Coconut Ladoo|⚪|Sweets|320|3.5|45.5|14.5|2.8|65|1 piece (40g)|Fresh coconut & condensed milk ball|vegetarian,gluten-free
kerala_parotta|Kerala Parotta|🫓|Breads|297|7.2|42.8|11.2|1.8|420|2 pcs (120g)|Flaky layered flatbread, Malabar specialty|vegetarian
chapati|Chapati|🫓|Breads|300|8.1|55.5|5.4|3.2|240|2 pcs (60g)|Whole wheat flatbread, everyday staple|vegan
puri|Puri|🫓|Breads|348|7.5|46.5|16.5|2.2|280|3 pcs (60g)|Deep-fried puffed wheat bread|vegan
naan|Naan|🫓|Breads|310|9.5|55.8|6.5|1.8|480|1 piece (80g)|Leavened oven-baked flatbread|vegetarian
aloo_paratha|Aloo Paratha|🫓|Breads|265|6.5|40.5|8.5|2.8|380|1 piece (100g)|Whole wheat flatbread stuffed with spiced potato|vegetarian
kulcha|Kulcha|🫓|Breads|295|8.8|52.5|6.8|1.5|420|1 piece (80g)|Leavened soft flatbread, Punjab & North India|vegetarian
bhatura|Bhatura|🫓|Breads|348|8.2|48.5|14.5|1.8|380|1 piece (80g)|Deep-fried leavened fermented bread|vegetarian
pathiri|Pathiri|🫓|Breads|185|3.8|38.5|1.5|0.8|120|2 pcs (80g)|Kerala thin rice flour flatbread|vegan,gluten-free
pomfret_fry|Pomfret Fry|🐟|Seafood|185|22.5|4.5|8.5|0.0|580|1 piece (120g)|Marinated pomfret pan-fried with South Indian spices|non-veg,gluten-free
karimeen_pollichathu|Karimeen Pollichathu|🐟|Seafood|195|24.5|3.5|9.5|0.5|620|1 piece (150g)|Pearl spot fish wrapped in banana leaf & grilled|non-veg,gluten-free
prawn_fry|Prawn Fry|🍤|Seafood|165|20.5|4.2|7.5|0.0|580|1 serving (100g)|Crispy spiced fried prawns|non-veg,gluten-free
fish_fry|Fish Fry (Tawa)|🐟|Seafood|175|22.5|3.8|8.2|0.0|580|1 piece (120g)|Spiced fish pan-fried with South Indian masala|non-veg,gluten-free
crab_masala|Crab Masala|🦀|Seafood|148|18.5|4.5|6.5|0.5|680|1 serving (150g)|Spicy crab cooked in coconut & tomato gravy|non-veg,gluten-free
squid_fry|Squid (Koonthal) Fry|🦑|Seafood|158|18.5|5.5|7.2|0.0|580|1 serving (120g)|Crispy fried squid rings with Kerala spices|non-veg,gluten-free
sardine_fry|Sardine (Mathi) Fry|🐟|Seafood|195|22.5|3.5|10.5|0.0|520|2 pcs (100g)|Crispy fried sardines marinated in red chilli|non-veg,gluten-free
mackerel_curry|Mackerel (Ayala) Curry|🐟|Seafood|165|18.5|4.5|8.2|0.5|580|1 serving (150g)|Spicy mackerel curry in kodampuli gravy|non-veg,gluten-free
chicken_fry|Chicken Fry (Kerala)|🍗|Meat|265|28.5|4.2|14.5|0.5|580|1 serving (150g)|Crispy spiced fried chicken, Kerala style|non-veg,gluten-free
beef_fry|Beef Ularthiyathu|🥩|Meat|285|28.5|4.8|16.5|0.8|620|1 serving (150g)|Kerala dry-fried beef with coconut & spices|non-veg,gluten-free
mutton_fry|Mutton Chukka|🥩|Meat|295|28.5|3.5|18.5|0.5|620|1 serving (150g)|Dry-fried mutton with South Indian spices|non-veg,gluten-free
chicken_65|Chicken 65|🍗|Meat|285|25.5|8.5|16.5|0.5|680|1 serving (120g)|Spicy deep-fried chicken, Chennai street food classic|non-veg
pepper_chicken|Pepper Chicken|🍗|Meat|245|26.5|3.5|13.5|0.8|580|1 serving (150g)|Dry pepper-spiced chicken stir-fry|non-veg,gluten-free
egg_omelette|Egg Omelette (South Indian)|🍳|Meat|185|12.5|3.5|13.5|0.5|380|2 eggs (120g)|Spiced egg omelette with onion, chilli & tomato|vegetarian,gluten-free
boiled_egg|Boiled Egg|🥚|Meat|155|12.5|1.1|10.5|0.0|125|2 eggs (100g)|Hard-boiled egg, protein powerhouse|vegetarian,gluten-free
raw_banana|Raw Banana (Plantain)|🍌|Vegetables|97|1.4|22.8|0.4|2.5|4|1 medium (120g)|Unripe banana, used in South Indian cooking|vegan,gluten-free
drumstick|Drumstick (Moringa)|🥢|Vegetables|42|2.8|6.5|0.5|3.5|42|1 cup (100g)|Moringa pods, rich in iron & vitamins|vegan,gluten-free
raw_jackfruit|Raw Jackfruit|🫙|Vegetables|95|1.7|23.2|0.6|1.5|38|1 cup (100g)|Young jackfruit used as meat substitute|vegan,gluten-free
ash_gourd|Ash Gourd (White Gourd)|⬜|Vegetables|13|0.4|2.8|0.1|0.8|11|1 cup (100g)|Cooling vegetable used in olan & kootu|vegan,gluten-free
yam|Elephant Foot Yam (Suran)|🍠|Vegetables|118|1.5|25.8|0.5|3.5|18|1 cup (100g)|Dense starchy tuber with earthy flavour|vegan,gluten-free
bitter_gourd|Bitter Gourd (Pavakka)|🥒|Vegetables|17|0.9|3.2|0.2|2.5|8|1 medium (100g)|Bitter vegetable with blood sugar benefits|vegan,gluten-free
ladies_finger|Ladies Finger (Okra)|🫛|Vegetables|33|1.9|7.1|0.2|3.2|7|1 cup (100g)|Mucilaginous vegetable rich in fibre|vegan,gluten-free
tapioca|Tapioca (Kappa)|⬜|Vegetables|160|0.5|38.5|0.2|1.8|14|1 cup (120g)|Boiled cassava, Kerala staple with fish curry|vegan,gluten-free
colocasia|Colocasia (Taro/Chembu)|🫙|Vegetables|98|1.5|22.5|0.2|4.1|11|1 cup (100g)|Taro root used in South Indian curries|vegan,gluten-free
drumstick_leaves|Drumstick Leaves (Murungai)|🌿|Vegetables|92|6.7|12.5|1.7|2.5|9|1 cup (50g)|Moringa leaves, iron & calcium powerhouse|vegan,gluten-free
mango_ripe|Ripe Mango (Alphonso)|🥭|Fruits|70|0.5|16.2|0.3|1.6|1|1 medium (150g)|King of fruits, rich in Vitamin C & A|vegan,gluten-free
banana_ripe|Ripe Banana (Nendran)|🍌|Fruits|122|1.3|28.5|0.5|2.1|1|1 medium (150g)|Kerala native banana, nutritious & filling|vegan,gluten-free
coconut_fresh|Fresh Coconut|🥥|Fruits|354|3.3|15.2|33.5|9.0|20|1/4 piece (50g)|Fresh coconut meat, rich in healthy fats|vegan,gluten-free
tender_coconut_meat|Tender Coconut Meat|🥥|Fruits|65|0.8|12.5|1.5|0.9|105|1 serving (100g)|Soft jelly meat from young coconut|vegan,gluten-free
jackfruit_ripe|Ripe Jackfruit|🍈|Fruits|95|1.7|23.2|0.6|1.5|2|5 pods (100g)|Sweet tropical fruit, good source of potassium|vegan,gluten-free
pineapple|Pineapple|🍍|Fruits|50|0.5|13.1|0.1|1.4|1|1 cup (165g)|Tropical fruit rich in Vitamin C & manganese|vegan,gluten-free
guava|Guava|🟢|Fruits|68|2.6|14.3|1.0|5.4|2|1 medium (100g)|Vitamin C powerhouse, common South Indian fruit|vegan,gluten-free
tamarind_fruit|Tamarind (raw)|🟤|Fruits|239|2.8|62.5|0.6|5.1|28|1 tbsp (30g)|Sour fruit used as souring agent in South Indian cooking|vegan,gluten-free
filter_coffee|Filter Coffee|☕|Beverages|58|1.5|9.5|1.8|0.0|45|1 cup (150ml)|Strong South Indian coffee with milk & sugar|vegetarian,gluten-free
masala_chai|Masala Chai|🍵|Beverages|65|1.8|10.5|1.8|0.0|45|1 cup (150ml)|Spiced Indian tea with milk, ginger & cardamom|vegetarian,gluten-free
buttermilk|Buttermilk (Moru/Chaas)|🥛|Beverages|40|3.2|4.5|1.0|0.0|185|1 glass (200ml)|Diluted churned yogurt with cumin & curry leaves|vegetarian,gluten-free
tender_coconut|Tender Coconut Water|🥥|Beverages|19|0.7|3.7|0.2|0.0|105|1 medium (300ml)|Natural electrolyte-rich coconut water|vegan,gluten-free
sweet_lassi|Sweet Lassi|🥛|Beverages|148|4.5|22.5|4.5|0.0|85|1 glass (250ml)|Blended sweetened yogurt drink|vegetarian,gluten-free
ragi_malt|Ragi Malt|🟤|Beverages|128|3.5|26.5|0.8|1.8|85|1 glass (200ml)|Finger millet porridge drink, nutritious & filling|vegan,gluten-free
jigarthanda|Jigarthanda|🍨|Beverages|165|4.5|28.5|4.5|0.0|85|1 glass (300ml)|Madurai's iconic cold milk drink with sarsaparilla & almond gum|vegetarian,gluten-free
nannari_sherbet|Nannari Sherbet|🟢|Beverages|85|0.2|21.5|0.1|0.0|8|1 glass (200ml)|Cooling Indian sarsaparilla root drink|vegan,gluten-free
rose_milk|Rose Milk|🌹|Beverages|125|3.2|21.5|3.2|0.0|65|1 glass (200ml)|Chilled milk with rose syrup, South Indian favourite|vegetarian,gluten-free
paal_kapi|Paal Kapi (Milk Coffee)|☕|Beverages|95|3.5|12.5|3.2|0.0|65|1 glass (200ml)|Sweetened milk coffee, South Indian style|vegetarian,gluten-free
whole_milk|Whole Milk|🥛|Dairy|67|3.4|4.7|3.9|0.0|44|1 glass (200ml)|Full-fat cow's milk, rich in calcium|vegetarian,gluten-free
curd_yogurt|Curd (Plain Yogurt)|🥛|Dairy|98|3.5|11.4|4.5|0.0|46|1 bowl (150g)|Homemade set curd, probiotic-rich|vegetarian,gluten-free
paneer|Paneer (Cottage Cheese)|🧀|Dairy|265|18.3|1.2|21.0|0.0|28|100g|Fresh Indian cottage cheese, high protein|vegetarian,gluten-free
ghee|Ghee (Clarified Butter)|🫙|Dairy|900|0.0|0.0|99.5|0.0|2|1 tbsp (14g)|Clarified butter, traditional cooking fat|vegetarian,gluten-free
coconut_milk|Coconut Milk (thick)|🥛|Dairy|230|2.3|5.5|23.8|2.2|15|1/2 cup (100ml)|Thick coconut milk used in Kerala curries|vegan,gluten-free
coconut_chutney|Coconut Chutney|🫙|Condiments|195|2.5|8.5|17.5|3.8|280|2 tbsp (50g)|Fresh coconut ground with green chilli & ginger|vegan,gluten-free
tomato_chutney|Tomato Chutney|🍅|Condiments|75|1.8|10.5|3.2|2.2|380|2 tbsp (50g)|Tangy tomato-onion chutney tempered with mustard|vegan,gluten-free
green_chutney|Green Chutney (Coriander)|🌿|Condiments|65|2.5|8.5|2.5|3.2|380|2 tbsp (50g)|Fresh coriander & mint chutney|vegan,gluten-free
mango_pickle|Mango Pickle (Avakaya)|🥭|Condiments|95|0.8|12.5|4.5|1.5|2580|1 tbsp (20g)|Spicy oil-cured raw mango pickle|vegan,gluten-free
idli_podi|Idli Podi (Gun Powder)|🟤|Condiments|350|15.5|42.5|12.5|6.5|580|1 tbsp (15g)|Spiced lentil & sesame powder served with idli|vegan,gluten-free
sambar_powder|Sambar Powder|🟤|Condiments|292|12.5|42.5|9.5|12.5|180|1 tsp (5g)|Aromatic spice blend for sambar|vegan,gluten-free
rasam_powder|Rasam Powder|🟤|Condiments|280|10.5|40.5|8.5|10.5|85|1 tsp (5g)|Spice blend of pepper, cumin & coriander for rasam|vegan,gluten-free
papad|Papad (Roasted)|💿|Condiments|355|21.5|55.5|4.5|1.5|1480|1 piece (15g)|Thin crispy lentil wafer, roasted|vegan,gluten-free
tamarind_paste|Tamarind Paste|🟤|Condiments|180|2.5|45.5|0.5|3.5|28|1 tbsp (20g)|Concentrated tamarind used as souring agent|vegan,gluten-free
`;

// ── Parse food data ─────────────────────────────────────────────────────────
export const FOODS = FOODS_RAW.trim().split('\n')
  .filter(l => l.trim() && !l.startsWith('//'))
  .map(line => {
    const [id, name, emoji, cat, cal, pro, carb, fat, fib, sod, srv, desc, tagsStr] = line.split('|');
    return {
      id, name, emoji, cat,
      cal: +cal, pro: +pro, carb: +carb, fat: +fat,
      fib: +fib, sod: +sod,
      srv, desc,
      tags: tagsStr ? tagsStr.split(',') : [],
    };
  });

// ── Macro bar ────────────────────────────────────────────────────────────────
function MacroBar({ label, value, unit, color, pct }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#555' }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#111' }}>{value}{unit}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: '#f0f0f0', overflow: 'hidden' }}>
        <Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
    </View>
  );
}

// ── Tag pill ─────────────────────────────────────────────────────────────────
const TAG_COLORS = { vegan: '#16a34a', vegetarian: '#65a30d', 'non-veg': '#dc2626',
  'gluten-free': '#9333ea' };
function TagPill({ tag }) {
  const color = TAG_COLORS[tag] || '#6b7280';
  return (
    <View style={{ backgroundColor: color + '18', borderRadius: 20, paddingHorizontal: 8,
      paddingVertical: 3, marginRight: 6, marginBottom: 4, borderWidth: 1, borderColor: color + '40' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{tag}</Text>
    </View>
  );
}

// ── Food Detail Modal ─────────────────────────────────────────────────────────
function FoodDetailModal({ food, visible, onClose, C, theme }) {
  const [per100, setPer100] = useState(false);
  const slideY = useRef(new Animated.Value(600)).current;
  useEffect(() => {
    if (visible) Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
    else Animated.timing(slideY, { toValue: 600, duration: 250, useNativeDriver: true }).start();
  }, [visible]);

  if (!food) return null;

  // Scale values to per-100g if toggled. Derive scale factor from serving string.
  const match = food.srv.match(/(\d+(\.\d+)?)g/);
  const grams = match ? parseFloat(match[1]) : 100;
  const factor = per100 ? 100 / grams : 1;
  const v = (n) => +(n * factor).toFixed(1);

  const cal = v(food.cal), pro = v(food.pro), carb = v(food.carb),
        fat = v(food.fat), fib = v(food.fib), sod = v(food.sod);

  const maxCal = 600;
  const MACROS = [
    { label: 'Calories',    value: cal,  unit: ' kcal', color: '#f97316', pct: Math.min(cal / maxCal, 1) },
    { label: 'Protein',     value: pro,  unit: 'g',     color: '#3b82f6', pct: Math.min(pro / 50, 1) },
    { label: 'Carbs',       value: carb, unit: 'g',     color: '#f59e0b', pct: Math.min(carb / 300, 1) },
    { label: 'Fat',         value: fat,  unit: 'g',     color: '#ef4444', pct: Math.min(fat / 65, 1) },
    { label: 'Fibre',       value: fib,  unit: 'g',     color: '#10b981', pct: Math.min(fib / 28, 1) },
    { label: 'Sodium',      value: sod,  unit: 'mg',    color: '#8b5cf6', pct: Math.min(sod / 2300, 1) },
  ];

  const bg = theme?.surface?.default || '#ffffff';
  const textPrimary = theme?.text?.primary || '#111111';
  const textSecondary = theme?.text?.secondary || '#555555';
  const brand = theme?.brand?.[600] || '#4f46e5';
  const border = theme?.border?.subtle || '#e5e7eb';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={onClose} />
      <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '88%', transform: [{ translateY: slideY }],
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20 }}>
        {/* Handle */}
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: border,
          alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingTop: 8 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
            <Text style={{ fontSize: 52 }}>{food.emoji}</Text>
            <View style={{ flex: 1, marginLeft: 16, marginTop: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, letterSpacing: -0.3 }}>{food.name}</Text>
              <Text style={{ fontSize: 13, color: brand, fontWeight: '600', marginTop: 2 }}>{food.srv}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                {food.tags.map(t => <TagPill key={t} tag={t} />)}
              </View>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: textSecondary, lineHeight: 20, marginBottom: 16 }}>{food.desc}</Text>

          {/* Serving toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: border, borderRadius: 12,
            padding: 3, marginBottom: 20, alignSelf: 'flex-start' }}>
            {['Standard serving', 'Per 100g'].map((lbl, i) => (
              <TouchableOpacity key={lbl} onPress={() => setPer100(i === 1)}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
                  backgroundColor: per100 === (i === 1) ? bg : 'transparent' }}>
                <Text style={{ fontSize: 12, fontWeight: '700',
                  color: per100 === (i === 1) ? brand : textSecondary }}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick macro pills */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[
              { label: 'kcal', val: cal, bg: '#fff7ed', color: '#ea580c' },
              { label: 'P', val: pro+'g', bg: '#eff6ff', color: '#2563eb' },
              { label: 'C', val: carb+'g', bg: '#fffbeb', color: '#d97706' },
              { label: 'F', val: fat+'g', bg: '#fef2f2', color: '#dc2626' },
            ].map(m => (
              <View key={m.label} style={{ flex: 1, backgroundColor: m.bg, borderRadius: 12,
                padding: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: m.color }}>{m.val}</Text>
                <Text style={{ fontSize: 10, color: m.color, fontWeight: '600', marginTop: 2 }}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Detailed bars */}
          <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary, marginBottom: 12 }}>
            Nutrition Breakdown
          </Text>
          {MACROS.map(m => <MacroBar key={m.label} {...m} />)}

          <Text style={{ fontSize: 10, color: textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 15 }}>
            Source: IFCT 2017 (NIN/ICMR) · Values are approximate · % bars based on daily RDA
          </Text>
          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Food Card ────────────────────────────────────────────────────────────────
function FoodCard({ food, onPress, theme }) {
  const bg = theme?.surface?.default || '#fff';
  const textPrimary = theme?.text?.primary || '#111';
  const textSecondary = theme?.text?.secondary || '#555';
  const border = theme?.border?.subtle || '#e5e7eb';
  const brand = theme?.brand?.[600] || '#4f46e5';
  const CAT_COLORS = {
    Breakfast:'#f97316',Rice:'#eab308',Curry:'#ef4444',Dal:'#84cc16',
    Snacks:'#f59e0b',Sweets:'#ec4899',Breads:'#a78bfa',Seafood:'#06b6d4',
    Meat:'#ef4444',Vegetables:'#22c55e',Fruits:'#fb923c',
    Beverages:'#8b5cf6',Dairy:'#60a5fa',Condiments:'#f472b6',
  };
  const accent = CAT_COLORS[food.cat] || brand;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={{ backgroundColor: bg, borderRadius: 16, marginHorizontal: 16, marginBottom: 10,
        borderLeftWidth: 4, borderLeftColor: accent,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
        shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
        <Text style={{ fontSize: 36 }}>{food.emoji}</Text>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary, letterSpacing: -0.2 }}
            numberOfLines={1}>{food.name}</Text>
          <Text style={{ fontSize: 12, color: textSecondary, marginTop: 1 }}>{food.srv}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            {[
              { label: `${food.cal} kcal`, bg: '#fff7ed', color: '#ea580c' },
              { label: `P ${food.pro}g`,   bg: '#eff6ff', color: '#2563eb' },
              { label: `C ${food.carb}g`,  bg: '#fffbeb', color: '#d97706' },
              { label: `F ${food.fat}g`,   bg: '#fef2f2', color: '#dc2626' },
            ].map(m => (
              <View key={m.label} style={{ backgroundColor: m.bg, borderRadius: 6,
                paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: m.color }}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={textSecondary} style={{ marginLeft: 4 }} />
      </View>
    </TouchableOpacity>
  );
}

// ── Main NutritionScreen ──────────────────────────────────────────────────────
export default function NutritionScreen() {
  const C = usePalette();
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [selectedFood, setSelectedFood] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return FOODS.filter(f => {
      const catMatch = activeCat === 'All' || f.cat === activeCat;
      const qMatch = !q || f.name.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q) || f.tags.join(' ').includes(q);
      return catMatch && qMatch;
    });
  }, [search, activeCat]);

  const bg = theme?.surface?.raised || '#fafafa';
  const card = theme?.surface?.default || '#fff';
  const textPrimary = theme?.text?.primary || '#111';
  const textSecondary = theme?.text?.secondary || '#555';
  const brand = theme?.brand?.[600] || '#4f46e5';
  const brand50 = theme?.brand?.[50] || '#eef2ff';
  const border = theme?.border?.subtle || '#e5e7eb';
  const borderDefault = theme?.border?.default || '#d1d5db';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={{ backgroundColor: brand, paddingTop: Platform.OS === 'android' ? 16 : 12,
        paddingBottom: 20, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>
          Nutrition Facts
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
          {FOODS.length} South Indian & Indian foods · IFCT 2017
        </Text>
        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 14, marginTop: 14, paddingHorizontal: 14, borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.25)' }}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.8)" />
          <TextInput
            style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#fff',
              paddingVertical: 12, letterSpacing: 0.1 }}
            placeholder="Search foods…"
            placeholderTextColor="rgba(255,255,255,0.55)"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: card, borderBottomWidth: 1, borderBottomColor: border }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
        {NUTRITION_CATEGORIES.map(c => {
          const active = activeCat === c.key;
          return (
            <TouchableOpacity key={c.key} onPress={() => setActiveCat(c.key)} activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                backgroundColor: active ? brand : brand50,
                borderWidth: 1, borderColor: active ? brand : border }}>
              <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700',
                color: active ? '#fff' : textSecondary }}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Result count */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: textSecondary }}>
          {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          {activeCat !== 'All' ? ` in ${activeCat}` : ''}
          {search ? ` matching "${search}"` : ''}
        </Text>
      </View>

      {/* Food list */}
      <FlatList
        data={filtered}
        keyExtractor={f => f.id}
        renderItem={({ item }) => (
          <FoodCard food={item} theme={theme} onPress={() => setSelectedFood(item)} />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 40 }}>🔍</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary, marginTop: 12 }}>
              No foods found
            </Text>
            <Text style={{ fontSize: 13, color: textSecondary, marginTop: 4 }}>
              Try a different search or category
            </Text>
          </View>
        }
      />

      {/* Detail modal */}
      <FoodDetailModal
        food={selectedFood}
        visible={!!selectedFood}
        onClose={() => setSelectedFood(null)}
        C={C}
        theme={theme}
      />
    </View>
  );
}
