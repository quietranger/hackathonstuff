module.exports = {
    SOCIAL_CONNECTORS: {
        "lc":"Symphony",
        "tw":"Twitter"
    },
    USER_TYPE: {
        GS_USER: "lc",
        TW_USER: "tw",
        SYSTEM_ACCOUNT: "system"
    },
    PER_USER_METADATA_DOCUMENT_ID: 'perUserMetadata',
    LEFTNAV_GROUPS_DOCUMENT_ID: 'leftnavGroups',
    FILTER_ID: 'filters',
    FTUE_DOCUMENT_ID: 'ftue',
    CLIENT_VERSION: 'DESKTOP',
    AUTH_MASK: "2",
    LOGIN_PAGE: '',
    MIN_SEARCH_LENGTH: 2,
    DEFAULT_SETTINGS: {
        DESKTOP:{
            'CHANNEL': {
                showNotification: true,
                blink: false,
                persist: false,
                showNotification: true,
                notificationColor: '#b5616a',
                playSound: true,
                showStreamAlerts: false
            },
            'CHATROOM': {
                showNotification: true,
                blink: false,
                persist: false,
                notificationColor: '#b5616a',
                disableInput: false,
                playSound: true,
                showStreamAlerts: false
            },
            'FILTER': {
                showNotification: true,
                blink: false,
                persist: false,
                notificationColor: '#b5616a',
                playSound: true,
                showStreamAlerts: false
            },
            'IM': {
                showNotification: true,
                blink: false,
                persist: false,
                notificationColor: '#b5616a',
                disableInput: false,
                playSound: true,
                showStreamAlerts: true
            },
            'APPLICATION': {
                showNotification: true,
                blink: true,
                persist: false,
                notificationColor: '#b5616a',
                disableInput: false,
                playSound: true,
                showStreamAlerts: true
            }
        }
    },
    COLOR_PALETTE: [
        ['#ab8ead', '#b5616a', '#ebc875'],
        ['#a3be77', '#58c6ff', '#ebab58']
    ],
    BLINKING_COLOR_MAP: {
        "#ab8ead": "#9d6da0",
        "#b5616a": "#bc4855",
        "#ebc875": "#edbf52",
        "#a3be77": "#9bc655",
        "#58c6ff": "#2baff4",
        "#ebab58": "#f19f35"
    },
    TYPING_DELAY: 3000,
    MSG_REAPER_ALLOWANCE: 100,
    EMOJI_URL: './img/emoji',
    ALLOWABLE_EMOJI: [":projito:",":lime:",":picard_facepalm:", ":facepalm:", ":blush:", ":scream:", ":smirk:", ":smiley:", ":stuck_out_tongue_closed_eyes:", ":stuck_out_tongue_winking_eye:", ":rage:", ":disappointed:", ":sob:", ":kissing_heart:", ":wink:", ":pensive:", ":confounded:", ":flushed:", ":relaxed:", ":mask:", ":heart:", ":broken_heart:", ":sunny:", ":umbrella:", ":cloud:", ":snowflake:", ":snowman:", ":zap:", ":cyclone:", ":foggy:", ":ocean:", ":cat:", ":dog:", ":mouse:", ":hamster:", ":rabbit:", ":wolf:", ":frog:", ":tiger:", ":koala:", ":bear:", ":pig:", ":pig_nose:", ":cow:", ":boar:", ":monkey_face:", ":monkey:", ":horse:", ":racehorse:", ":camel:", ":sheep:", ":elephant:", ":panda_face:", ":snake:", ":bird:", ":baby_chick:", ":hatched_chick:", ":hatching_chick:", ":chicken:", ":penguin:", ":turtle:", ":bug:", ":honeybee:", ":ant:", ":beetle:", ":snail:", ":octopus:", ":tropical_fish:", ":fish:", ":whale:", ":whale2:", ":dolphin:", ":cow2:", ":ram:", ":rat:", ":water_buffalo:", ":tiger2:", ":rabbit2:", ":dragon:", ":goat:", ":rooster:", ":dog2:", ":pig2:", ":mouse2:", ":ox:", ":dragon_face:", ":blowfish:", ":crocodile:", ":dromedary_camel:", ":leopard:", ":cat2:", ":poodle:", ":paw_prints:", ":bouquet:", ":cherry_blossom:", ":tulip:", ":four_leaf_clover:", ":rose:", ":sunflower:", ":hibiscus:", ":maple_leaf:", ":leaves:", ":fallen_leaf:", ":herb:", ":mushroom:", ":cactus:", ":palm_tree:", ":evergreen_tree:", ":deciduous_tree:", ":chestnut:", ":seedling:", ":blossom:", ":ear_of_rice:", ":shell:", ":globe_with_meridians:", ":sun_with_face:", ":full_moon_with_face:", ":new_moon_with_face:", ":new_moon:", ":waxing_crescent_moon:", ":first_quarter_moon:", ":waxing_gibbous_moon:", ":full_moon:", ":waning_gibbous_moon:", ":last_quarter_moon:", ":waning_crescent_moon:", ":last_quarter_moon_with_face:", ":first_quarter_moon_with_face:", ":moon:", ":earth_africa:", ":earth_americas:", ":earth_asia:", ":volcano:", ":milky_way:", ":partly_sunny:", ":octocat:", ":squirrel:", ":bamboo:", ":gift_heart:", ":dolls:", ":school_satchel:", ":mortar_board:", ":flags:", ":fireworks:", ":sparkler:", ":wind_chime:", ":rice_scene:", ":jack_o_lantern:", ":ghost:", ":santa:", ":christmas_tree:", ":gift:", ":bell:", ":no_bell:", ":tanabata_tree:", ":tada:", ":confetti_ball:", ":balloon:", ":crystal_ball:", ":cd:", ":dvd:", ":floppy_disk:", ":camera:", ":video_camera:", ":movie_camera:", ":computer:", ":tv:", ":iphone:", ":phone:", ":telephone:", ":telephone_receiver:", ":pager:", ":fax:", ":minidisc:", ":vhs:", ":sound:", ":speaker:", ":mute:", ":loudspeaker:", ":mega:", ":hourglass:", ":hourglass_flowing_sand:", ":alarm_clock:", ":watch:", ":radio:", ":satellite:", ":loop:", ":mag:", ":mag_right:", ":unlock:", ":lock:", ":lock_with_ink_pen:", ":closed_lock_with_key:", ":key:", ":bulb:", ":flashlight:", ":high_brightness:", ":low_brightness:", ":electric_plug:", ":battery:", ":calling:", ":email:", ":mailbox:", ":postbox:", ":bath:", ":bathtub:", ":shower:", ":toilet:", ":wrench:", ":nut_and_bolt:", ":hammer:", ":seat:", ":moneybag:", ":yen:", ":dollar:", ":pound:", ":euro:", ":credit_card:", ":money_with_wings:", ":e-mail:", ":inbox_tray:", ":outbox_tray:", ":envelope:", ":incoming_envelope:", ":postal_horn:", ":mailbox_closed:", ":mailbox_with_mail:", ":mailbox_with_no_mail:", ":door:", ":smoking:", ":bomb:", ":gun:", ":hocho:", ":pill:", ":syringe:", ":page_facing_up:", ":page_with_curl:", ":bookmark_tabs:", ":bar_chart:", ":chart_with_upwards_trend:", ":chart_with_downwards_trend:", ":scroll:", ":clipboard:", ":calendar:", ":date:", ":card_index:", ":file_folder:", ":open_file_folder:", ":scissors:", ":pushpin:", ":paperclip:", ":black_nib:", ":pencil2:", ":straight_ruler:", ":triangular_ruler:", ":closed_book:", ":green_book:", ":blue_book:", ":orange_book:", ":notebook:", ":notebook_with_decorative_cover:", ":ledger:", ":books:", ":bookmark:", ":name_badge:", ":microscope:", ":telescope:", ":newspaper:", ":football:", ":basketball:", ":soccer:", ":baseball:", ":tennis:", ":8ball:", ":rugby_football:", ":bowling:", ":golf:", ":mountain_bicyclist:", ":bicyclist:", ":horse_racing:", ":snowboarder:", ":swimmer:", ":surfer:", ":ski:", ":spades:", ":hearts:", ":clubs:", ":diamonds:", ":gem:", ":ring:", ":trophy:", ":musical_score:", ":musical_keyboard:", ":violin:", ":space_invader:", ":video_game:", ":black_joker:", ":flower_playing_cards:", ":game_die:", ":dart:", ":mahjong:", ":clapper:", ":memo:", ":pencil:", ":book:", ":art:", ":microphone:", ":headphones:", ":trumpet:", ":saxophone:", ":guitar:", ":shoe:", ":sandal:", ":high_heel:", ":lipstick:", ":boot:", ":shirt:", ":tshirt:", ":necktie:", ":womans_clothes:", ":dress:", ":running_shirt_with_sash:", ":jeans:", ":kimono:", ":bikini:", ":ribbon:", ":tophat:", ":crown:", ":womans_hat:", ":mans_shoe:", ":closed_umbrella:", ":briefcase:", ":handbag:", ":pouch:", ":purse:", ":eyeglasses:", ":fishing_pole_and_fish:", ":coffee:", ":tea:", ":sake:", ":baby_bottle:", ":beer:", ":beers:", ":cocktail:", ":tropical_drink:", ":wine_glass:", ":fork_and_knife:", ":pizza:", ":hamburger:", ":fries:", ":poultry_leg:", ":meat_on_bone:", ":spaghetti:", ":curry:", ":fried_shrimp:", ":bento:", ":sushi:", ":fish_cake:", ":rice_ball:", ":rice_cracker:", ":rice:", ":ramen:", ":stew:", ":oden:", ":dango:", ":egg:", ":bread:", ":doughnut:", ":custard:", ":icecream:", ":ice_cream:", ":shaved_ice:", ":birthday:", ":cake:", ":cookie:", ":chocolate_bar:", ":candy:", ":lollipop:", ":honey_pot:", ":apple:", ":green_apple:", ":tangerine:", ":lemon:", ":cherries:", ":grapes:", ":watermelon:", ":strawberry:", ":peach:", ":melon:", ":banana:", ":pear:", ":pineapple:", ":sweet_potato:", ":eggplant:", ":tomato:", ":corn:", ":alien:", ":angel:", ":anger:", ":angry:", ":anguished:", ":astonished:", ":baby:", ":blue_heart:", ":blush:", ":boom:", ":bow:", ":bowtie:", ":boy:", ":bride_with_veil:", ":broken_heart:", ":bust_in_silhouette:", ":busts_in_silhouette:", ":clap:", ":cold_sweat:", ":collision:", ":confounded:", ":confused:", ":construction_worker:", ":cop:", ":couple_with_heart:", ":couple:", ":couplekiss:", ":cry:", ":crying_cat_face:", ":cupid:", ":dancer:", ":dancers:", ":dash:", ":disappointed:", ":dizzy_face:", ":dizzy:", ":droplet:", ":ear:", ":exclamation:", ":expressionless:", ":eyes:", ":facepunch:", ":family:", ":fearful:", ":feelsgood:", ":feet:", ":finnadie:", ":fire:", ":fist:", ":flushed:", ":frowning:", ":girl:", ":goberserk:", ":godmode:", ":green_heart:", ":grey_exclamation:", ":grey_question:", ":grimacing:", ":grin:", ":grinning:", ":guardsman:", ":haircut:", ":hand:", ":hankey:", ":hear_no_evil:", ":heart_eyes_cat:", ":heart_eyes:", ":heart:", ":heartbeat:", ":heartpulse:", ":hurtrealbad:", ":hushed:", ":imp:", ":information_desk_person:", ":innocent:", ":japanese_goblin:", ":japanese_ogre:", ":joy_cat:", ":joy:", ":kiss:", ":kissing_cat:", ":kissing_closed_eyes:", ":kissing_heart:", ":kissing_smiling_eyes:", ":kissing:", ":laughing:", ":lips:", ":love_letter:", ":man_with_gua_pi_mao:", ":man_with_turban:", ":man:", ":mask:", ":massage:", ":metal:", ":muscle:", ":musical_note:", ":nail_care:", ":neckbeard:", ":neutral_face:", ":no_good:", ":no_mouth:", ":nose:", ":notes:", ":ok_hand:", ":ok_woman:", ":older_man:", ":older_woman:", ":open_hands:", ":open_mouth:", ":pensive:", ":persevere:", ":person_frowning:", ":person_with_blond_hair:", ":person_with_pouting_face:", ":point_down:", ":point_left:", ":point_right:", ":point_up_2:", ":point_up:", ":poop:", ":pouting_cat:", ":pray:", ":princess:", ":punch:", ":purple_heart:", ":question:", ":rage:", ":rage1:", ":rage2:", ":rage3:", ":rage4:", ":raised_hand:", ":raised_hands:", ":relaxed:", ":relieved:", ":revolving_hearts:", ":runner:", ":running:", ":satisfied:", ":scream_cat:", ":scream:", ":see_no_evil:", ":skull:", ":sleeping:", ":sleepy:", ":smile_cat:", ":smile:", ":smiley_cat:", ":smiley:", ":smiling_imp:", ":smirk_cat:", ":smirk:", ":sob:", ":sparkling_heart:", ":sparkles:", ":speak_no_evil:", ":speech_balloon:", ":star:", ":star2:", ":stuck_out_tongue_closed_eyes:", ":stuck_out_tongue_winking_eye:", ":stuck_out_tongue:", ":sunglasses:", ":suspect:", ":sweat_drops:", ":sweat_smile:", ":sweat:", ":thought_balloon:", ":-1:", ":thumbsdown:", ":thumbsup:", ":+1:", ":tired_face:", ":tongue:", ":triumph:", ":trollface:", ":two_hearts:", ":two_men_holding_hands:", ":two_women_holding_hands:", ":unamused:", ":v:", ":walking:", ":wave:", ":weary:", ":wink2:", ":wink:", ":woman:", ":worried:", ":yellow_heart:", ":yum:", ":zzz:", ":109:", ":house:", ":house_with_garden:", ":school:", ":office:", ":post_office:", ":hospital:", ":bank:", ":convenience_store:", ":love_hotel:", ":hotel:", ":wedding:", ":church:", ":department_store:", ":european_post_office:", ":city_sunrise:", ":city_sunset:", ":japanese_castle:", ":european_castle:", ":tent:", ":factory:", ":tokyo_tower:", ":japan:", ":mount_fuji:", ":sunrise_over_mountains:", ":sunrise:", ":stars:", ":statue_of_liberty:", ":bridge_at_night:", ":carousel_horse:", ":rainbow:", ":ferris_wheel:", ":fountain:", ":roller_coaster:", ":ship:", ":speedboat:", ":boat:", ":sailboat:", ":rowboat:", ":anchor:", ":rocket:", ":airplane:", ":helicopter:", ":steam_locomotive:", ":tram:", ":mountain_railway:", ":bike:", ":aerial_tramway:", ":suspension_railway:", ":mountain_cableway:", ":tractor:", ":blue_car:", ":oncoming_automobile:", ":car:", ":red_car:", ":taxi:", ":oncoming_taxi:", ":articulated_lorry:", ":bus:", ":oncoming_bus:", ":rotating_light:", ":police_car:", ":oncoming_police_car:", ":fire_engine:", ":ambulance:", ":minibus:", ":truck:", ":train:", ":station:", ":train2:", ":bullettrain_front:", ":bullettrain_side:", ":light_rail:", ":monorail:", ":railway_car:", ":trolleybus:", ":ticket:", ":fuelpump:", ":vertical_traffic_light:", ":traffic_light:", ":warning:", ":construction:", ":beginner:", ":atm:", ":slot_machine:", ":busstop:", ":barber:", ":hotsprings:", ":checkered_flag:", ":crossed_flags:", ":izakaya_lantern:", ":moyai:", ":circus_tent:", ":performing_arts:", ":round_pushpin:", ":triangular_flag_on_post:", ":jp:", ":kr:", ":cn:", ":us:", ":fr:", ":es:", ":it:", ":ru:", ":gb:", ":uk:", ":de:", ":100:", ":1234:", ":one:", ":two:", ":three:", ":four:", ":five:", ":six:", ":seven:", ":eight:", ":nine:", ":keycap_ten:", ":zero:", ":hash:", ":symbols:", ":arrow_backward:", ":arrow_down:", ":arrow_forward:", ":arrow_left:", ":capital_abcd:", ":abcd:", ":abc:", ":arrow_lower_left:", ":arrow_lower_right:", ":arrow_right:", ":arrow_up:", ":arrow_upper_left:", ":arrow_upper_right:", ":arrow_double_down:", ":arrow_double_up:", ":arrow_down_small:", ":arrow_heading_down:", ":arrow_heading_up:", ":leftwards_arrow_with_hook:", ":arrow_right_hook:", ":left_right_arrow:", ":arrow_up_down:", ":arrow_up_small:", ":arrows_clockwise:", ":arrows_counterclockwise:", ":rewind:", ":fast_forward:", ":information_source:", ":ok:", ":twisted_rightwards_arrows:", ":repeat:", ":repeat_one:", ":new:", ":top:", ":up:", ":cool:", ":free:", ":ng:", ":cinema:", ":koko:", ":signal_strength:", ":u5272:", ":u5408:", ":u55b6:", ":u6307:", ":u6708:", ":u6709:", ":u6e80:", ":u7121:", ":u7533:", ":u7a7a:", ":u7981:", ":sa:", ":restroom:", ":mens:", ":womens:", ":baby_symbol:", ":no_smoking:", ":parking:", ":wheelchair:", ":metro:", ":baggage_claim:", ":accept:", ":wc:", ":potable_water:", ":put_litter_in_its_place:", ":secret:", ":congratulations:", ":m:", ":passport_control:", ":left_luggage:", ":customs:", ":ideograph_advantage:", ":cl:", ":sos:", ":id:", ":no_entry_sign:", ":underage:", ":no_mobile_phones:", ":do_not_litter:", ":non-potable_water:", ":no_bicycles:", ":no_pedestrians:", ":children_crossing:", ":no_entry:", ":eight_spoked_asterisk:", ":eight_pointed_black_star:", ":heart_decoration:", ":vs:", ":vibration_mode:", ":mobile_phone_off:", ":chart:", ":currency_exchange:", ":aries:", ":taurus:", ":gemini:", ":cancer:", ":leo:", ":virgo:", ":libra:", ":scorpius:", ":sagittarius:", ":capricorn:", ":aquarius:", ":pisces:", ":ophiuchus:", ":six_pointed_star:", ":negative_squared_cross_mark:", ":a:", ":b:", ":ab:", ":o2:", ":diamond_shape_with_a_dot_inside:", ":recycle:", ":end:", ":on:", ":soon:", ":clock1:", ":clock130:", ":clock10:", ":clock1030:", ":clock11:", ":clock1130:", ":clock12:", ":clock1230:", ":clock2:", ":clock230:", ":clock3:", ":clock330:", ":clock4:", ":clock430:", ":clock5:", ":clock530:", ":clock6:", ":clock630:", ":clock7:", ":clock730:", ":clock8:", ":clock830:", ":clock9:", ":clock930:", ":heavy_dollar_sign:", ":copyright:", ":registered:", ":tm:", ":x:", ":heavy_exclamation_mark:", ":bangbang:", ":interrobang:", ":o:", ":heavy_multiplication_x:", ":heavy_plus_sign:", ":heavy_minus_sign:", ":heavy_division_sign:", ":white_flower:", ":heavy_check_mark:", ":ballot_box_with_check:", ":radio_button:", ":link:", ":curly_loop:", ":wavy_dash:", ":part_alternation_mark:", ":trident:", ":black_square:", ":white_square:", ":white_check_mark:", ":black_square_button:", ":white_square_button:", ":black_circle:", ":white_circle:", ":red_circle:", ":large_blue_circle:", ":large_blue_diamond:", ":large_orange_diamond:", ":small_blue_diamond:", ":small_orange_diamond:", ":small_red_triangle:", ":small_red_triangle_down:", ":shipit:"],
    EMOJI_REPLACEMENTS: {
        ':D': ':laughing:',
        ':\\)': ':smiley:',
        ':P': ':stuck_out_tongue:',
        ':\\(':  ':anguished:'
    },
    EMOJI_CUSTOM: {
        ':facepalm:'            : 'facepalm.png',
        ':picard_facepalm:'     : 'picard_facepalm.png',
        ':lime:'                : 'projito.png',
        ':projito:'             : 'projito.png'
    },
    BLAST_WARNING_COUNT: 500,
    MAX_UPLOAD_FILES: 10,
    DEFAULT_IMAGE_URL: 'https://s3.amazonaws.com/user-pics-demo/small/symphony_small.png',
    HASHTAG_REGEX: /[^!@#$%^&*()+=<>,./?`~:;'"\\|\s-]+/ig,
    CASHTAG_REGEX: /[\w\d][\w\d_.]*/ig,
    EMOJI_REGEX: /([\w\d_]+)/ig,
    URL_REGEX: /(http[s]?:\/\/[\/\w\d\[\]\(\)@!$&'*~?#.,:;=%_+-]+)/ig,
    VALID_AVATAR_FILE_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif'],
    VALID_AVATAR_FILE_SIZE: 10000000 //10MB
};