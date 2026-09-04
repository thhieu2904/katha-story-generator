export interface HistorySource {
  title: {
    vi: string;
    km: string;
  };
  publisher: string;
  url: string;
}

export interface HistoryMilestone {
  id: string;
  stage: number;
  period: {
    vi: string;
    km: string;
  };
  title: {
    vi: string;
    km: string;
  };
  subtitle: {
    vi: string;
    km: string;
  };
  summary: {
    vi: string;
    km: string;
  };
  body: {
    vi: string;
    km: string;
  };
  artifacts: {
    vi: string[];
    km: string[];
  };
  sources: readonly HistorySource[];
  image: {
    src: string;
    alt: string;
  };
}

export const KHMER_HISTORY_MILESTONES: ReadonlyArray<HistoryMilestone> = [
  {
    id: 'stage-1',
    stage: 1,
    period: {
      vi: 'Thế kỷ I – VII',
      km: 'សតវត្សរ៍ទី ១ – ៧',
    },
    title: {
      vi: 'Văn hóa Óc Eo & Vương quốc Phù Nam',
      km: 'វប្បធម៌អូរកែវ និងអាណាចក្រហ្វូណន',
    },
    subtitle: {
      vi: 'Bình minh châu thổ và thương cảng quốc tế cổ đại',
      km: 'ព្រឹក្សព្រលឹមនៃដីសណ្ដ និងកំពង់ផែពាណិជ្ជកម្មបុរាណ',
    },
    summary: {
      vi: 'Thời kỳ khởi thủy rực rỡ với cảng thị Óc Eo sầm uất tại vùng Ba Thê (An Giang). Nền văn minh nông nghiệp lúa nước kết hợp thương mại hàng hải quốc tế kết nối Ấn Độ, La Mã và phương Đông.',
      km: 'សម័យកាលដំបូងដ៏រុងរឿងជាមួយកំពង់ផែអូរកែវនៅបាថេ (អានយ៉ាង) តភ្ជាប់ការធ្វើពាណិជ្ជកម្មតាមសមុទ្រជាមួយឥណ្ឌា រ៉ូម និងបណ្ដាប្រទេសលោកខាងកើត។',
    },
    body: {
      vi: 'Văn hóa Óc Eo hình thành và phát triển từ thế kỷ I đến thế kỷ VII sau Công nguyên tại vùng trũng châu thổ sông Mekong, với trung tâm đô thị cảng thị Ba Thê - Óc Eo (nay thuộc tỉnh An Giang, Kiên Giang và các vùng phụ cận).\n\nĐây là một trong những nền văn minh cổ đại phát triển bậc nhất Đông Nam Á thời bấy giờ, minh chứng qua hàng nghìn di vật khảo cổ tinh xảo: con dấu khắc chữ Phạn cổ, tiền vàng La Mã thời hoàng đế Antoninus Pius, đồ gốm mịn, cùng các pho tượng sa thạch thể hiện tinh thần dung hợp giữa Phật giáo và Ấn Độ giáo (thờ thần Shiva, Vishnu, Brahma).\n\nCư dân thời kỳ này đã xây dựng mạng lưới kênh đào xuyên đồng bằng phục vụ tưới tiêu nông nghiệp và giao thương hàng hải, tạo tiền đề thủy nông độc đáo lưu truyền qua nhiều thế hệ.',
      km: 'វប្បធម៌អូរកែវបានកកើត និងអភិវឌ្ឍពីសតវត្សរ៍ទី ១ ដល់ទី ៧ នៃគ.ស នៅតំបន់ទំនាបដីសណ្ដទន្លេមេគង្គ ជាមួយមជ្ឈមណ្ឌលទីក្រុងកំពង់ផែបាថេ - អូរកែវ (បច្ចុប្បន្ននៅខេត្តអានយ៉ាង គៀនយ៉ាង)។\n\nនេះជាអារ្យធម៌បុរាណដ៏ជឿនលឿនបំផុតមួយនៅអាស៊ីអាគ្នេយ៍ ឆ្លុះបញ្ចាំងតាមរយៈវត្ថុបុរាណរាប់ពាន់៖ ត្រាអក្សរសំស្ក្រឹត កាក់មាសរ៉ូម៉ាំង កុលាលភាជន៍ល្អិត និងរូបសំណាកថ្មភក់នៃព្រះពុទ្ធសាសនា និងព្រហ្មញ្ញសាសនា។\n\nប្រជាជនសម័យនោះបានជីកព្រែកខ្វាត់ខ្វែងបម្រើដល់ការធ្វើកសិកម្ម និងការដឹកជញ្ជូនតាមផ្លូវទឹក បង្កើតជាគ្រឹះធារាសាស្ត្រដ៏រឹងមាំ។',
    },
    artifacts: {
      vi: ['Con dấu chữ Phạn cổ', 'Trang sức vàng chạm khắc', 'Tượng thần sa thạch', 'Hệ thống kênh cổ Ba Thê'],
      km: ['ត្រាអក្សរសំស្ក្រឹតបុរាណ', 'គ្រឿងអលង្ការមាសចម្លាក់', 'រូបសំណាកថ្មភក់', 'ប្រព័ន្ធព្រែកជីកបាថេ'],
    },
    sources: [
      {
        title: {
          vi: 'Khu di tích khảo cổ Óc Eo – Ba Thê',
          km: 'តំបន់បុរាណវិទ្យាអូរកែវ – បាថេ',
        },
        publisher: 'UNESCO World Heritage Centre',
        url: 'https://whc.unesco.org/en/tentativelists/6572',
      },
    ],
    image: {
      src: '/vision-samples/naga_7_dau.jpg',
      alt: 'Hình tượng Rắn thần Naga và nghệ thuật điêu khắc cổ',
    },
  },
  {
    id: 'stage-2',
    stage: 2,
    period: {
      vi: 'Thế kỷ VII – IX',
      km: 'សតវត្សរ៍ទី ៧ – ៩',
    },
    title: {
      vi: 'Thời kỳ Thủy Chân Lạp & Châu thổ Mekong',
      km: 'សម័យកាលចេនឡាទឹក និងវប្បធម៌ដីសណ្ដ',
    },
    subtitle: {
      vi: 'Sự kế thừa đền tháp và nông nghiệp ngập nước',
      km: 'ការបន្តវេនប្រាសាទបុរាណ និងកសិកម្មតំបន់ទឹក',
    },
    summary: {
      vi: 'Sự chuyển tiếp lịch sử đưa cư dân Khmer gắn bó mật thiết với vùng đồng bằng ngập lũ Nam Bộ. Kiến trúc gạch nung, tháp đá cổ và chữ khắc Khmer cổ bắt đầu định hình rõ nét.',
      km: 'ការផ្លាស់ប្តូរប្រវត្តិសាស្ត្របាននាំប្រជាជនខ្មែរឱ្យផ្សារភ្ជាប់ជាមួយតំបន់ទំនាបលិចទឹក។ ស្ថាបត្យកម្មប្រាសាទឥដ្ឋ ថ្មបុរាណ និងអក្សរខ្មែរចាប់ផ្តើមលេចចេញជារូបរាង។',
    },
    body: {
      vi: 'Sau giai đoạn Phù Nam, thời kỳ Chân Lạp (đặc biệt là Thủy Chân Lạp ở vùng châu thổ hạ lưu) chứng kiến sự phân bố dân cư dọc theo các triền đất giồng cát cao ráo, thích ứng khéo léo với chế độ ngập nước theo mùa của dòng Cửu Long.\n\nCác di tích kiến trúc giai đoạn này chủ yếu xây bằng gạch nung kết hợp sa thạch, tiêu biểu như tháp Chót Mạt, tháp Bình Thạnh (Tây Ninh) hay nền tháp cổ ở Long An và Đồng Tháp. Nghệ thuật kiến trúc mang phong cách Sambor Prei Kuk và Prei Khmeng với các vòm cuốn chạm khắc hoa văn lá cúc và hoa sen cách điệu.\n\nGiai đoạn này đánh dấu sự xuất hiện của các văn bia đá khắc bằng chữ Khmer cổ bên cạnh chữ Phạn, ghi lại các nghi lễ tôn giáo, việc phụng hiến đất đai và bảo vệ nguồn nước.',
      km: 'ក្រោយសម័យហ្វូណន សម័យចេនឡាទឹកបានឃើញការរស់នៅតាមបណ្ដោយដីទួលខ្ពស់ សម្របខ្លួនតាមរដូវទឹកឡើងនៃទន្លេមេគង្គ។\n\nស្ថាបត្យកម្មនាសម័យនេះភាគច្រើនសាងសង់ពីឥដ្ឋផ្សំថ្មភក់ ដូចជាប្រាសាទចោតម៉ាត ប៊ិញថាញ់ (តីនិញ)។ ក្បូរក្បាច់រចនាបថសំបូរព្រៃគុហ៍ និងព្រៃក្មេងត្រូវបានឆ្លាក់យ៉ាងផ្ចិតផ្ចង់។\n\nសម័យនេះក៏កត់សម្គាល់វត្តមានសិលាចារឹកអក្សរខ្មែរបុរាណទន្ទឹមនឹងអក្សរសំស្ក្រឹត កត់ត្រាពីពិធីសាសនា និងការឧទ្ទិសដីធ្លី។',
    },
    artifacts: {
      vi: ['Tháp gạch Chót Mạt & Bình Thạnh', 'Văn bia chữ Khmer cổ', 'Bệ thờ Yoni - Linga sa thạch', 'Gốm hỏa táng cổ'],
      km: ['ប្រាសាទឥដ្ឋចោតម៉ាត និងប៊ិញថាញ់', 'សិលាចារឹកអក្សរខ្មែរបុរាណ', 'ទម្រយោនី និងលិង្គថ្មភក់', 'កុលាលភាជន៍បុរាណ'],
    },
    sources: [
      {
        title: {
          vi: 'Khu đền Sambor Prei Kuk, địa điểm khảo cổ Ishanapura cổ',
          km: 'តំបន់ប្រាសាទសំបូរព្រៃគុក នៃទីក្រុងបុរាណឥសានបុរៈ',
        },
        publisher: 'UNESCO World Heritage Centre',
        url: 'https://whc.unesco.org/en/list/1532',
      },
    ],
    image: {
      src: '/vision-samples/bayon_face_tower.jpg',
      alt: 'Tháp mặt cười nghệ thuật kiến trúc đền tháp đá Khmer',
    },
  },
  {
    id: 'stage-3',
    stage: 3,
    period: {
      vi: 'Thế kỷ IX – XV',
      km: 'សតវត្សរ៍ទី ៩ – ១៥',
    },
    title: {
      vi: 'Kỷ nguyên Văn minh Angkor rực rỡ',
      km: 'យុគសម័យអារ្យធម៌អង្គរដ៏រុងរឿង',
    },
    subtitle: {
      vi: 'Đỉnh cao kiến trúc đền núi, điêu khắc đá và thiên sử thi',
      km: 'កំពូលស្ថាបត្យកម្មប្រាសាទភ្នំ ចម្លាក់ថ្ម និងវីរកថា',
    },
    summary: {
      vi: 'Giai đoạn phát triển đỉnh cao của văn minh Khmer với kỳ quan Angkor Wat, Angkor Thom. Nghệ thuật chạm khắc sa thạch tinh vi, vũ điệu Apsara và kho tàng sử thi Reamker định hình bản sắc văn hóa muôn đời.',
      km: 'ដំណាក់កាលអភិវឌ្ឍន៍កំពូលនៃអារ្យធម៌ខ្មែរជាមួយប្រាសាទអង្គរវត្ត និងអង្គរធំ។ សិល្បៈចម្លាក់ថ្មភក់ របាំអប្សរា និងវីរកថារាមកេរ្តិ៍បានកំណត់អត្តសញ្ញាណវប្បធម៌។',
    },
    body: {
      vi: 'Kỷ nguyên Angkor là đỉnh cao rực rỡ của văn minh Đông Nam Á cổ đại. Hệ thống hồ chứa nước khổng lồ (Baray) cùng hàng trăm quần thể đền núi bằng đá sa thạch kiên cố đã biến nơi đây thành trung tâm nông nghiệp và nghệ thuật hùng vĩ.\n\nTrên vùng đồng bằng phương Nam, dấu ấn Angkor lan tỏa qua các đền đài vệ tinh, tượng Phật Thích Ca ngồi thiền định được rắn thần Naga 7 đầu che chở, các bức phù điêu vũ nữ Apsara mềm mại và sử thi Reamker (Ramayana phiên bản Khmer).\n\nNhững nguyên lý thẩm mỹ về bố cục đối xứng, hoa văn kbach (kbach hoa sen, kbach búp chuối, kbach dây leo phka chan) sáng tạo từ thời kỳ Angkor đã trở thành ngôn ngữ nghệ thuật bất biến trong trang trí chùa chiền và điêu khắc Khmer cho đến ngày nay.',
      km: 'យុគសម័យអង្គរជាចំណុចកំពូលនៃអារ្យធម៌អាស៊ីអាគ្នេយ៍។ ប្រព័ន្ធបារាយណ៍ដ៏ធំធេង និងប្រាសាទភ្នំថ្មភក់រាប់រយបានប្រែក្លាយអាណាចក្រឱ្យក្លាយជាមជ្ឈមណ្ឌលកសិកម្ម និងសិល្បៈដ៏មហិមា។\n\nឥទ្ធិពលអង្គរបានសាយភាយដល់តំបន់ភាគខាងត្បូងតាមរយៈប្រាសាទរណប រូបបដិមាព្រះពុទ្ធប្រក់នាគ និងក្បាច់ចម្លាក់អប្សរាដ៏រស់រវើក។\n\nក្បូរក្បាច់រចនាពីសម័យអង្គរ (ក្បាច់ផ្កាចន្ទន៍ ត្របកឈូក ភ្ញីទេស) បានក្លាយជាព្រលឹងសិល្បៈមិនចេះរីងស្ងួតក្នុងស្ថាបត្យកម្មវត្តអារាមខ្មែររហូតមកដល់បច្ចុប្បន្ន។',
    },
    artifacts: {
      vi: ['Kỳ quan Angkor Wat', 'Phù điêu vũ nữ Apsara', 'Tượng Phật thiền định tọa Naga', 'Thiên sử thi Reamker'],
      km: ['ប្រាសាទអង្គរវត្ត', 'ចម្លាក់អប្សរា', 'ព្រះពុទ្ធប្រក់នាគ', 'វីរកថារាមកេរ្តិ៍'],
    },
    sources: [
      {
        title: {
          vi: 'Quần thể Angkor',
          km: 'តំបន់អង្គរ',
        },
        publisher: 'UNESCO World Heritage Centre',
        url: 'https://whc.unesco.org/en/list/668',
      },
      {
        title: {
          vi: 'Vũ kịch cung đình Hoàng gia Campuchia',
          km: 'របាំព្រះរាជទ្រព្យនៃព្រះរាជាណាចក្រកម្ពុជា',
        },
        publisher: 'UNESCO Intangible Cultural Heritage',
        url: 'https://ich.unesco.org/en/RL/royal-ballet-of-cambodia-00060',
      },
    ],
    image: {
      src: '/vision-samples/angkor_wat.jpg',
      alt: 'Kỳ quan kiến trúc đền tháp Angkor Wat',
    },
  },
  {
    id: 'stage-4',
    stage: 4,
    period: {
      vi: 'Thế kỷ XVI – XVIII',
      km: 'សតវត្សរ៍ទី ១៦ – ១៨',
    },
    title: {
      vi: 'Tụ cư & Hệ thống Chùa Tháp Nam Bộ',
      km: 'ការតាំងទីលំនៅ និងប្រព័ន្ធវត្តអារាមនៅភាគខាងត្បូង',
    },
    subtitle: {
      vi: 'Phum sóc định cư và ngôi chùa là trung tâm đời sống tâm linh',
      km: 'ភូមិស្រុកតាំងលំនៅ និងវត្តអារាមជាបេះដូងនៃជីវិត',
    },
    summary: {
      vi: 'Cộng đồng người Khmer định cư bền vững trên các giồng cát màu mỡ Tây Nam Bộ (Trà Vinh, Sóc Trăng, Bạc Liêu, Kiên Giang). Hơn 450 ngôi chùa Phật giáo Nam tông được dựng lập, trở thành cái nôi gìn giữ chữ viết, đạo đức và tri thức dân gian.',
      km: 'សហគមន៍ខ្មែរតាំងលំនៅប្រកបដោយចីរភាពនៅតាមតំបន់ភូមិស្រុកនៅត្រាវិញ សុកត្រាំង បាកលៀវ គៀនយ៉ាង។ វត្តអារាមថេរវាទជាង ៤៥០ វត្តបានក្លាយជាកន្លែងថែរក្សាអក្សរសាស្ត្រ និងសីលធម៌។',
    },
    body: {
      vi: 'Từ thế kỷ XVI đến thế kỷ XVIII, các cộng đồng người Khmer định hình địa bàn sinh tụ vững chắc tại vùng đồng bằng sông Cửu Long, quần cư thành các "Phum" (xóm) và "Sóc" (làng) trên các dải đất cát giồng cao ráo ven biển và dọc theo các dòng kênh tự nhiên.\n\nMỗi phum sóc đều gắn bó hữu cơ với một ngôi chùa Phật giáo Nam tông Khmer (Wat). Ngôi chùa không chỉ là chốn tôn nghiêm tu hành mà còn là bảo tàng văn hóa sống, trường học dạy chữ Khmer, thư viện lưu giữ sách lá bối (Satra), và trung tâm gắn kết cộng đồng.\n\nTại đây, phong tục thanh niên xuất gia tu báo hiếu trở thành truyền thống tốt đẹp — một trường học rèn luyện nhân cách, đạo đức và tri thức trước khi lập nghiệp. Mối dây liên kết bền chặt giữa Chùa, Phum và Sóc đã giữ gìn bản sắc Khmer nguyên vẹn qua bao thăng trầm thời gian.',
      km: 'ពីសតវត្សរ៍ទី ១៦ ដល់ ១៨ សហគមន៍ខ្មែរបានតាំងទីលំនៅយ៉ាងរឹងមាំនៅតំបន់ដីសណ្ដទន្លេមេគង្គ បង្កើតជាភូមិ និងស្រុកនៅលើដីទួលក្បែរព្រែកជីកធម្មជាតិ។\n\nភូមិស្រុកនីមួយៗតែងតែមានវត្តអារាមព្រះពុទ្ធសាសនាថេរវាទ។ វត្តមិនត្រឹមតែជាទីសក្ការៈទេ តែក៏ជាសាលារៀនអក្សរខ្មែរ បណ្ណាល័យសាស្រ្តាស្លឹករឹត និងជាមជ្ឈមណ្ឌលសហគមន៍។\n\nទំនៀមទម្លាប់បួសសងគុណរបស់យុវជនបានក្លាយជាប្រពៃណីដ៏ល្អផូរផង់ ដើម្បីហាត់ពត់លត់ដំសីលធម៌ និងចំណេះដឹង។ ការផ្សារភ្ជាប់រវាងវត្ត និងភូមិស្រុកបានជួយថែរក្សាអត្តសញ្ញាណខ្មែរយ៉ាងគង់វង្ស។',
    },
    artifacts: {
      vi: ['Kinh lá bối Satra', 'Cột cờ thần chim cút Moha Prum', 'Nghệ thuật đắp tượng nóc chùa', 'Đại lễ dâng y Kathina'],
      km: ['សាស្រ្តាស្លឹករឹត', 'សសរទង់ហង្ស', 'សិល្បៈចម្លាក់ដំបូលវត្ត', 'ពិធីបុណ្យកឋិនទាន'],
    },
    sources: [
      {
        title: {
          vi: 'Bảo tồn và phát huy văn hóa đồng bào Khmer Nam Bộ',
          km: 'ការអភិរក្ស និងលើកតម្លៃវប្បធម៌ខ្មែរនៅភាគខាងត្បូង',
        },
        publisher: 'Cục Du lịch Quốc gia Việt Nam',
        url: 'https://vietnamtourism.gov.vn/post/45355',
      },
      {
        title: {
          vi: 'Chùa Dơi – nơi hội tụ văn hóa Khmer, Việt, Hoa',
          km: 'វត្តដំរីស – ទីប្រជុំវប្បធម៌ខ្មែរ វៀតណាម និងចិន',
        },
        publisher: 'Cục Du lịch Quốc gia Việt Nam',
        url: 'https://dantoc.vietnamtourism.gov.vn/kham-pha-chua-doi-noi-hoi-tu-van-hoa-khmer-viet-hoa/',
      },
    ],
    image: {
      src: '/vision-samples/kathina_khmer.jpg',
      alt: 'Đại lễ dâng y Kathina và nét đẹp chùa tháp Khmer Nam Bộ',
    },
  },
  {
    id: 'stage-5',
    stage: 5,
    period: {
      vi: 'Thế kỷ XIX – XX',
      km: 'សតវត្សរ៍ទី ១៩ – ២០',
    },
    title: {
      vi: 'Lễ hội Truyền thống & Sân khấu Di sản',
      km: 'ពិធីបុណ្យប្រពៃណី និងសិល្បៈល្ខោនបាសាក់',
    },
    subtitle: {
      vi: 'Sắc màu Ok Om Bok, tiếng đàn Chapei và nghệ thuật Dù Kê',
      km: 'ពណ៌ចម្រុះអកអំបុក សំឡេងចាប៉ីដងវែង និងល្ខោនបាសាក់',
    },
    summary: {
      vi: 'Sự thăng hoa của đời sống tâm linh qua ba lễ hội lớn: Chôl Chnăm Thmây, Sene Dolta và Ok Om Bok (đua ghe Ngo). Nghệ thuật ca kịch Dù Kê ra đời, kết hợp cùng múa Rô-băm, múa bóng Sbek Thom và dàn nhạc ngũ âm Pinpeat rộn rã.',
      km: 'ភាពរីកចម្រើននៃជីវិតស្មារតីតាមរយៈពិធីបុណ្យធំៗទាំងបី៖ ចូលឆ្នាំថ្មី សែនដូនតា និងអកអំបុក (ប្រណាំងទូក ង)។ សិល្បៈល្ខោនបាសាក់បានចាប់កំណើត ផ្សំជាមួយរបាំរ៉ូកាំ និងភ្លេងពិណពាទ្យ។',
    },
    body: {
      vi: 'Giai đoạn này ghi dấu sự thăng hoa rực rỡ của các hình thái diễn xướng dân gian và lễ hội cổ truyền Khmer Nam Bộ, đan xen hài hòa trong bức tranh văn hóa đa dạng của vùng đồng bằng châu thổ.\n\nBa lễ hội lớn định hình nhịp sống tinh thần trong năm: Tết Chôl Chnăm Thmây (mừng năm mới vào tháng 4 dương lịch), Lễ Sen Dolta (lễ cúng ông bà tổ tiên) và Lễ Ok Om Bok (cúng Trăng, đút cốm dẹp và ngày hội đua ghe Ngo sôi động trên sông Maspero Sóc Trăng thu hút hàng vạn người cổ vũ).\n\nĐặc biệt, vào thập niên 1920 tại Trà Vinh, nghệ thuật ca kịch Dù Kê ra đời và nhanh chóng trở thành món ăn tinh thần đặc sắc của bà con Nam Bộ, kết hợp cùng các điệu múa cung đình Rô-băm, nghệ thuật kịch múa bóng rỗi Sbek Thom, tiếng đàn Chapei Dang Veng kể chuyện dân gian và dàn nhạc ngũ âm Pinpeat ngân vang trong các dịp đại lễ.',
      km: 'សម័យកាលនេះបានកត់សម្គាល់ការរីកចម្រើនយ៉ាងខ្លាំងនៃសិល្បៈសម្ដែងប្រជាប្រិយ និងពិធីបុណ្យប្រពៃណីខ្មែរនៅភាគខាងត្បូង។\n\nពិធីបុណ្យធំៗទាំងបីបានកំណត់ចង្វាក់ជីវិតស្មារតី៖ ពិធីបុណ្យចូលឆ្នាំថ្មីប្រពៃណីជាតិ ពិធីបុណ្យសែនដូនតា និងពិធីបុណ្យអកអំបុកសំពះព្រះខែ (ជាមួយនឹងការប្រណាំងទូក ង ដ៏អធិកអធមនៅលើដងទន្លេម៉ាសប៉េរ៉ូ ខេត្តសុកត្រាំង)។\n\nជាពិសេស នៅទសវត្សរ៍ឆ្នាំ ១៩២០ នៅត្រាវិញ សិល្បៈល្ខោនបាសាក់ (យូកេ) បានចាប់កំណើត រួមផ្សំជាមួយរបាំរ៉ូកាំ ល្ខោនស្បែកធំ សំឡេងចាប៉ីដងវែង និងវង់ភ្លេងពិណពាទ្យដ៏រស់រវើក។',
    },
    artifacts: {
      vi: ['Ghe Ngo truyền thống (Tuk Ngo)', 'Đàn Chapei Dang Veng', 'Trang phục sân khấu Dù Kê', 'Dàn nhạc ngũ âm Pinpeat'],
      km: ['ទូក ង ប្រពៃណី', 'ចាប៉ីដងវែង', 'សម្លៀកបំពាក់ល្ខោនបាសាក់', 'វង់ភ្លេងពិណពាទ្យ'],
    },
    sources: [
      {
        title: {
          vi: 'Nghệ thuật sân khấu Dù Kê',
          km: 'សិល្បៈល្ខោនយូរកេ',
        },
        publisher: 'Cục Di sản văn hóa',
        url: 'https://dsvh.gov.vn/nghe-thuat-san-khau-du-ke-1038',
      },
      {
        title: {
          vi: 'Lễ hội đua ghe Ngo – sắc màu văn hóa Khmer Nam Bộ',
          km: 'ពិធីប្រណាំងទូក ង – ពណ៌វប្បធម៌ខ្មែរនៅភាគខាងត្បូង',
        },
        publisher: 'Cục Du lịch Quốc gia Việt Nam',
        url: 'https://dantoc.vietnamtourism.gov.vn/le-hoi-dua-ghe-ngo-sac-mau-van-hoa-khmer-nam-bo/',
      },
      {
        title: {
          vi: 'Sbek Thom – sân khấu bóng Khmer',
          km: 'ស្បែកធំ – ល្ខោនស្រមោលខ្មែរ',
        },
        publisher: 'UNESCO Intangible Cultural Heritage',
        url: 'https://ich.unesco.org/en/RL/sbek-thom-khmer-shadow-theatre-00108',
      },
    ],
    image: {
      src: '/vision-samples/ok_om_bok.jpg',
      alt: 'Lễ hội đua ghe Ngo và văn hóa Ok Om Bok',
    },
  },
  {
    id: 'stage-6',
    stage: 6,
    period: {
      vi: 'Thế kỷ XXI – Đương đại',
      km: 'សតវត្សរ៍ទី ២១ – បច្ចុប្បន្ន',
    },
    title: {
      vi: 'Bảo tồn Di sản & Kỷ nguyên Số hóa',
      km: 'ការអភិរក្សបេតិកភណ្ឌ និងយុគសម័យឌីជីថល',
    },
    subtitle: {
      vi: 'Di sản dân tộc tỏa sáng qua công nghệ và thế hệ trẻ',
      km: 'បេតិកភណ្ឌជាតិភ្លឺស្វាងតាមរយៈបច្ចេកវិទ្យា និងយុវជន',
    },
    summary: {
      vi: 'Các di sản phi vật thể quốc gia được vinh danh và bảo tồn bền vững. Công nghệ thị giác máy tính AI, không gian bảo tàng số 3D và nền tảng giáo dục tương tác Katha giúp di sản sống động và lan tỏa đến thế hệ trẻ toàn cầu.',
      km: 'បេតិកភណ្ឌអរូបីជាតិត្រូវបានលើកតម្កើង និងអភិរក្សប្រកបដោយចីរភាព។ បច្ចេកវិទ្យា AI សារមន្ទីរ 3D និងវេទិកា Katha ជួយឱ្យបេតិកភណ្ឌកាន់តែជិតស្និទ្ធជាមួយយុវជន។',
    },
    body: {
      vi: 'Bước vào thế kỷ XXI, kho tàng di sản văn hóa Khmer Nam Bộ bước sang chương mới của sự hồi sinh, tôn vinh và hội nhập sâu rộng. Hàng loạt giá trị văn hóa phi vật thể được ghi danh cấp quốc gia như: Lễ hội Ok Om Bok, Nghệ thuật Sân khấu Dù Kê, Lễ hội Chôl Chnăm Thmây, Nghệ thuật Chapei Dang Veng.\n\nHệ thống trường Phổ thông Dân tộc Nội trú và Học viện Phật giáo Nam tông Khmer tại Cần Thơ tạo môi trường đào tạo thế hệ trẻ vừa tinh thông tri thức hiện đại, vừa tự hào nắm giữ chìa khóa ngôn ngữ và cội nguồn văn hóa tổ tiên.\n\nĐặc biệt, sự hội tụ của công nghệ tương tác 3D ThingLink, AI thị giác máy tính nhận diện biểu tượng văn hóa và nền tảng Katha đang mở ra cánh cửa số hóa di sản — biến từng hiện vật, câu chuyện và phát âm Khmer thành trải nghiệm sống động, bất kỳ ai ở bất cứ đâu cũng có thể tìm hiểu và gìn giữ.',
      km: 'ឈានចូលសតវត្សរ៍ទី ២១ បេតិកភណ្ឌវប្បធម៌ខ្មែរបានឈានចូលទំព័រថ្មីនៃការអភិរក្ស និងសមាហរណកម្ម។ បេតិកភណ្ឌជាច្រើនត្រូវបានទទួលស្គាល់ជាបេតិកភណ្ឌជាតិ ដូចជាពិធីបុណ្យអកអំបុក ល្ខោនបាសាក់ បុណ្យចូលឆ្នាំថ្មី និងចាប៉ីដងវែង។\n\nប្រព័ន្ធសាលាជនជាតិអន្តេវាសិក និងពុទ្ធិកសាកលវិទ្យាល័យថេរវាទនៅកឹនធើបានបណ្ដុះបណ្ដាលយុវជនជំនាន់ក្រោយឱ្យមានចំណេះដឹង និងមោទនភាពចំពោះប្រភពដើម។\n\nជាពិសេស ការរួមបញ្ចូលគ្នានៃបច្ចេកវិទ្យា 3D ThingLink បច្ចេកវិទ្យា AI សម្គាល់រូបភាព និងវេទិកា Katha បានបើកទ្វារឌីជីថលូបនីយកម្មបេតិកភណ្ឌ — ជួយឱ្យមនុស្សគ្រប់គ្នានៅទូទាំងពិភពលោកអាចស្វែងយល់ និងថែរក្សាវប្បធម៌ខ្មែរយ៉ាងងាយស្រួល។',
    },
    artifacts: {
      vi: ['Bảo tàng số 3D tương tác', 'Thị giác máy tính nhận diện văn hóa', 'Học viện Phật giáo Nam tông Cần Thơ', 'Festival Đua ghe Ngo quốc tế'],
      km: ['សារមន្ទីរឌីជីថល 3D អន្តរកម្ម', 'បច្ចេកវិទ្យា AI សម្គាល់វប្បធម៌', 'ពុទ្ធិកសាកលវិទ្យាល័យថេរវាទកឹនធើ', 'ពិធីបុណ្យប្រណាំងទូក ង អន្តរជាតិ'],
    },
    sources: [
      {
        title: {
          vi: 'Cơ sở dữ liệu quốc gia về di sản văn hóa',
          km: 'មូលដ្ឋានទិន្នន័យជាតិស្តីពីបេតិកភណ្ឌវប្បធម៌',
        },
        publisher: 'Cục Di sản văn hóa',
        url: 'https://congdulieu.dsvh.gov.vn/',
      },
      {
        title: {
          vi: 'Bảo tồn và phát huy văn hóa đồng bào Khmer Nam Bộ',
          km: 'ការអភិរក្ស និងលើកតម្លៃវប្បធម៌ខ្មែរនៅភាគខាងត្បូង',
        },
        publisher: 'Cục Du lịch Quốc gia Việt Nam',
        url: 'https://vietnamtourism.gov.vn/post/45355',
      },
    ],
    image: {
      src: '/vision-samples/du_ke.jpg',
      alt: 'Nghệ thuật Sân khấu Dù Kê và thế hệ trẻ đương đại',
    },
  },
];
