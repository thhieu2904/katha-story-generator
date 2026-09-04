'use client';

import Image from 'next/image';
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { useUiCopy } from '@/features/language/useUiCopy';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { FloatingParticles } from './FloatingParticles';

type IntroLanguage = 'vi' | 'km';

interface IntroStep {
  name: string;
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  imageAlt: string;
  tags: string[];
}

interface IntroStat {
  value: string;
  label: string;
  desc: string;
}

interface IntroPillar {
  title: string;
  subtitle: string;
  body: string;
  tag: string;
  image: string;
  imageAlt: string;
  href: string;
  actionText: string;
}

interface IntroContent {
  enter: string;
  heroBadge: string;
  heroEyebrow: string;
  heroTitleFirst: string;
  heroTitleAccent: string;
  heroBody: string;
  startJourney: string;
  visitMuseum: string;
  livingCulture: string;
  livingCultureBody: string;
  stats: IntroStat[];
  pillarsEyebrow: string;
  pillarsTitle: string;
  pillarsSubtitle: string;
  pillars: IntroPillar[];
  purposeEyebrow: string;
  purposeTitle: string;
  purposes: Array<{ title: string; body: string }>;
  journeyEyebrow: string;
  journeyTitle: string;
  journeyAria: string;
  previousStep: string;
  nextStep: string;
  stepLabel: string;
  footerQuote: string;
  marquee: string;
  steps: IntroStep[];
}

const INTRO_CONTENT: Record<IntroLanguage, IntroContent> = {
  vi: {
    enter: 'Khám phá Katha',
    heroBadge: 'Nền tảng Di sản & Ngôn ngữ Khmer thế hệ mới',
    heroEyebrow: 'Văn hóa Khmer qua một góc nhìn mới',
    heroTitleFirst: 'Văn hóa không chỉ để ngắm.',
    heroTitleAccent: 'Mà để bước vào.',
    heroBody:
      'Katha đưa hình ảnh, ngôn ngữ và câu chuyện Khmer đến gần người trẻ bằng một trải nghiệm sống động, có ngữ cảnh và có thể thực hành.',
    startJourney: 'Đi qua hành trình',
    visitMuseum: 'Tham quan bảo tàng số',
    livingCulture: 'Một nền văn hóa đang sống',
    livingCultureBody: 'Trong lễ hội, bữa ăn và những câu chuyện mỗi ngày.',
    stats: [
      { value: '5+', label: 'Chặng học khép kín', desc: 'Nhìn · Hiểu · Nghe · Kể · Nói' },
      { value: 'AI', label: 'Thị giác máy tính', desc: 'Nhận diện hiện vật & văn hóa' },
      { value: '100%', label: 'Ngữ âm bản xứ chuẩn', desc: 'Có phiên âm & chỉnh tốc độ' },
      { value: '360°', label: 'Bảo tàng số & Niên đại', desc: 'Khám phá Phù Nam đến Angkor' },
    ],
    pillarsEyebrow: 'Trải nghiệm đa chiều',
    pillarsTitle: 'Bốn trụ cột đưa di sản vào đời sống số',
    pillarsSubtitle: 'Không chỉ là sách vở lý thuyết — Katha biến di sản thành tương tác sống động, có ngữ cảnh và ứng dụng được ngay.',
    pillars: [
      {
        title: 'Thị giác máy tính AI',
        subtitle: 'Chụp ảnh để mở câu chuyện',
        body: 'Nhận diện tượng Phật, hoa văn đền tháp, trang phục và món ăn truyền thống tức thì với AI thị giác máy tính.',
        tag: 'Vision AI',
        image: '/vision-samples/bayon_face_tower.jpg',
        imageAlt: 'Tháp mặt cười Bayon',
        href: '/admin/vision',
        actionText: 'Trải nghiệm AI',
      },
      {
        title: 'Ngữ âm & Luyện nói',
        subtitle: 'Phát âm chuẩn xác cùng người bản xứ',
        body: 'Nghe phát âm chuẩn giọng bản xứ với công nghệ chỉnh tốc độ chậm (0.7x, 0.8x), thu âm và nhận phản hồi.',
        tag: 'Phonetics & Audio',
        image: '/vision-samples/pinpeat.jpg',
        imageAlt: 'Dàn nhạc ngũ âm Pinpeat',
        href: '/admin/vision',
        actionText: 'Luyện phát âm',
      },
      {
        title: 'Truyện kể dân gian',
        subtitle: 'Thấm nhuần văn hóa qua tích xưa',
        body: 'Đắm mình trong kho tàng truyện cổ tích, ngụ ngôn Khmer song ngữ với giọng đọc truyền cảm và từ vựng gợi nhớ.',
        tag: 'Bilingual Stories',
        image: '/vision-samples/sbek_thom.jpg',
        imageAlt: 'Nghệ thuật Múa bóng rỗi Sbek Thom',
        href: '/admin/stories',
        actionText: 'Đọc truyện ngay',
      },
      {
        title: 'Bảo tàng số & Niên đại',
        subtitle: 'Hành trình ngàn năm di sản',
        body: 'Du hành qua các thời kỳ lịch sử Phù Nam, Chân Lạp, Angkor qua dòng thời gian niên đại và hiện vật trực quan.',
        tag: 'Heritage Timeline',
        image: '/vision-samples/angkor_wat.jpg',
        imageAlt: 'Kỳ quan Angkor Wat',
        href: '/admin/museum',
        actionText: 'Vào bảo tàng',
      },
    ],
    purposeEyebrow: 'Điều Katha hướng đến',
    purposeTitle: 'Để di sản được hiểu, được nhớ và được tiếp nối.',
    purposes: [
      {
        title: 'Đưa văn hóa đến gần hơn',
        body: 'Biến kiến thức thành trải nghiệm có hình ảnh, âm thanh và cảm xúc.',
      },
      {
        title: 'Học ngôn ngữ trong ngữ cảnh',
        body: 'Học từ và câu Khmer ngay trong câu chuyện văn hóa đang khám phá.',
      },
      {
        title: 'Nuôi dưỡng sự kết nối',
        body: 'Giúp thế hệ trẻ chủ động tìm hiểu và trân trọng các giá trị Khmer.',
      },
    ],
    journeyEyebrow: 'Một vòng học liền mạch',
    journeyTitle: 'Mỗi bước mở ra bước kế tiếp',
    journeyAria: 'Giới thiệu vòng học Katha',
    previousStep: 'Xem bước trước',
    nextStep: 'Xem bước tiếp theo',
    stepLabel: 'Bước',
    footerQuote:
      'Mỗi hình ảnh đều có một câu chuyện. Hãy bắt đầu câu chuyện đầu tiên của bạn.',
    marquee: 'NHÌN — HIỂU — NGHE — KỂ — KẾT NỐI',
    steps: [
      {
        name: 'Nhận diện',
        eyebrow: 'Bắt đầu từ điều bạn nhìn thấy',
        title: 'Một hình ảnh mở cánh cửa đầu tiên.',
        body: 'Tải ảnh hoặc chụp một hiện vật, lễ hội hay món ăn để bắt đầu hành trình khám phá.',
        image: '/vision-samples/tuong_quan_the_am.jpg',
        imageAlt: 'Tượng Quan Thế Âm Bồ Tát',
        tags: ['Hình ảnh', 'Chủ đề văn hóa'],
      },
      {
        name: 'Từ khóa',
        eyebrow: 'Gọi tên điều vừa khám phá',
        title: 'Làm quen với những từ khóa quan trọng.',
        body: 'Mỗi hình ảnh dẫn tới 3–5 từ Khmer có nghĩa, phiên âm và phát âm trước khi đi sâu hơn.',
        image: '/vision-samples/amok_trey.jpg',
        imageAlt: 'Món Amok trey',
        tags: ['Chữ Khmer', 'Nghĩa tiếng Việt', 'Nghe phát âm'],
      },
      {
        name: 'Nghe & đọc',
        eyebrow: 'Văn hóa sống trong câu chuyện',
        title: 'Theo câu chuyện để hiểu bối cảnh.',
        body: 'Hình ảnh và từ khóa được nối thành một câu chuyện song ngữ có thể vừa nghe vừa đọc.',
        image: '/vision-samples/ok_om_bok.jpg',
        imageAlt: 'Lễ hội Ok Om Bok',
        tags: ['Khmer ↔ Việt', 'Giọng kể', 'Truyện minh họa'],
      },
      {
        name: 'Luyện nói',
        eyebrow: 'Biến điều vừa học thành lời nói',
        title: 'Nghe một câu. Nói lại theo cách của bạn.',
        body: 'Người học luyện các câu Khmer thông dụng và nhận phản hồi để tự tin hơn trong giao tiếp.',
        image: '/vision-samples/chol_chnam_thmay.jpg',
        imageAlt: 'Tết Chôl Chnăm Thmây',
        tags: ['Câu thông dụng', 'Thu âm', 'Phản hồi'],
      },
      {
        name: 'Kết quả',
        eyebrow: 'Một hành trình được hoàn thành',
        title: 'Nhìn lại điều bạn đã hiểu và nói được.',
        body: 'Kết quả kết nối toàn bộ trải nghiệm và mở đường sang bảo tàng số để tiếp tục khám phá.',
        image: '/vision-samples/angkor_wat.jpg',
        imageAlt: 'Kiến trúc Khmer',
        tags: ['Tiến trình học', 'Khám phá tiếp', 'Bảo tàng số'],
      },
    ],
  },
  km: {
    enter: 'ស្វែងយល់ Katha',
    heroBadge: 'វេទិកាបេតិកភណ្ឌ និងភាសាខ្មែរជំនាន់ថ្មី',
    heroEyebrow: 'វប្បធម៌ខ្មែរតាមទស្សនៈថ្មី',
    heroTitleFirst: 'វប្បធម៌មិនមែនសម្រាប់តែទស្សនាទេ។',
    heroTitleAccent: 'ប៉ុន្តែសម្រាប់ចូលរួមស្វែងយល់។',
    heroBody:
      'Katha នាំរូបភាព ភាសា និងរឿងរ៉ាវខ្មែរមកកាន់យុវជន តាមរយៈបទពិសោធន៍រស់រវើក មានបរិបទ និងអាចអនុវត្តបាន។',
    startJourney: 'ចូលទៅកាន់ដំណើរ',
    visitMuseum: 'ទស្សនាសារមន្ទីរឌីជីថល',
    livingCulture: 'វប្បធម៌ដែលកំពុងរស់នៅ',
    livingCultureBody: 'នៅក្នុងពិធីបុណ្យ អាហារ និងរឿងរ៉ាវប្រចាំថ្ងៃ។',
    stats: [
      { value: '5+', label: 'ដំណាក់កាលសិក្សា', desc: 'មើល · យល់ · ស្តាប់ · និទាន · និយាយ' },
      { value: 'AI', label: 'ការមើលឃើញឆ្លាតវៃ', desc: 'សម្គាល់វត្ថុបុរាណ និងវប្បធម៌' },
      { value: '100%', label: 'សូរសព្ទដើមពិតៗ', desc: 'មានសូរសព្ទអន្តរជាតិ និងកែសម្រួលល្បឿន' },
      { value: '360°', label: 'សារមន្ទីរឌីជីថល', desc: 'ស្វែងយល់ពីហ្វូណនដល់អង្គរ' },
    ],
    pillarsEyebrow: 'បទពិសោធន៍ពហុវិមាត្រ',
    pillarsTitle: 'សសរស្តម្ភទាំងបួននាំបេតិកភណ្ឌចូលក្នុងយុគសម័យឌីជីថល',
    pillarsSubtitle: 'មិនត្រឹមតែជាទ្រឹស្តីក្នុងសៀវភៅទេ — Katha ធ្វើឱ្យចំណេះដឹងក្លាយជាការអនុវត្តរស់រវើក។',
    pillars: [
      {
        title: 'ការមើលឃើញវប្បធម៌ AI',
        subtitle: 'ថតរូបដើម្បីបើករឿងរ៉ាវ',
        body: 'សម្គាល់រូបសំណាក ក្បូរក្បាច់ប្រាសាទ សម្លៀកបំពាក់ និងម្ហូបប្រពៃណីភ្លាមៗជាមួយ AI។',
        tag: 'Vision AI',
        image: '/vision-samples/bayon_face_tower.jpg',
        imageAlt: 'ប្រាសាទបាយ័ន',
        href: '/admin/vision',
        actionText: 'សាកល្បង AI',
      },
      {
        title: 'សូរសព្ទ និងការហាត់និយាយ',
        subtitle: 'បញ្ចេញសំឡេងដើមត្រឹមត្រូវ',
        body: 'ស្តាប់សំឡេងដើម ជាមួយនឹងល្បឿនយឺត (0.7x, 0.8x) ថតសំឡេង និងទទួលមតិកែលម្អ។',
        tag: 'Phonetics & Audio',
        image: '/vision-samples/pinpeat.jpg',
        imageAlt: 'វង់ភ្លេងពិណពាទ្យ',
        href: '/admin/vision',
        actionText: 'ហាត់និយាយ',
      },
      {
        title: 'រឿងព្រេងនិទានពីរភាសា',
        subtitle: 'យល់ដឹងវប្បធម៌តាមរឿងបុរាណ',
        body: 'អានរឿងនិទានខ្មែរពីរភាសា ជាមួយសំឡេងនិទាន និងពាក្យគន្លឹះងាយចាំ។',
        tag: 'Bilingual Stories',
        image: '/vision-samples/sbek_thom.jpg',
        imageAlt: 'ល្ខោនស្បែកធំ',
        href: '/admin/stories',
        actionText: 'អានរឿងឥឡូវនេះ',
      },
      {
        title: 'សារមន្ទីរឌីជីថល និងប្រវត្តិសាស្ត្រ',
        subtitle: 'ដំណើររាប់ពាន់ឆ្នាំនៃបេតិកភណ្ឌ',
        body: 'ធ្វើដំណើរឆ្លងកាត់សម័យកាលហ្វូណន ចេនឡា អង្គរ តាមរយៈបន្ទាត់ពេលវេលាអន្តរកម្ម។',
        tag: 'Heritage Timeline',
        image: '/vision-samples/angkor_wat.jpg',
        imageAlt: 'ប្រាសាទអង្គរវត្ត',
        href: '/admin/museum',
        actionText: 'ចូលសារមន្ទីរ',
      },
    ],
    purposeEyebrow: 'គោលដៅរបស់ Katha',
    purposeTitle: 'ដើម្បីឱ្យបេតិកភណ្ឌត្រូវបានយល់ ចងចាំ និងបន្តទៅមុខ។',
    purposes: [
      {
        title: 'នាំវប្បធម៌ឱ្យកាន់តែជិតស្និទ្ធ',
        body: 'បំលែងចំណេះដឹងទៅជាបទពិសោធន៍ដែលមានរូបភាព សំឡេង និងអារម្មណ៍។',
      },
      {
        title: 'រៀនភាសាតាមបរិបទ',
        body: 'រៀនពាក្យ និងប្រយោគខ្មែរនៅក្នុងរឿងវប្បធម៌ដែលកំពុងស្វែងយល់។',
      },
      {
        title: 'បង្កើតការតភ្ជាប់',
        body: 'ជួយយុវជនស្វែងយល់ និងគោរពតម្លៃវប្បធម៌ខ្មែរដោយសកម្ម។',
      },
    ],
    journeyEyebrow: 'វដ្តសិក្សាដែលតភ្ជាប់គ្នា',
    journeyTitle: 'ជំហាននីមួយៗបើកទៅកាន់ជំហានបន្ទាប់',
    journeyAria: 'ការណែនាំអំពីវដ្តសិក្សា Katha',
    previousStep: 'មើលជំហានមុន',
    nextStep: 'មើលជំហានបន្ទាប់',
    stepLabel: 'ជំហាន',
    footerQuote: 'រូបភាពនីមួយៗមានរឿងរ៉ាវមួយ។ ចាប់ផ្តើមរឿងដំបូងរបស់អ្នក។',
    marquee: 'មើលឃើញ — យល់ — ស្តាប់ — និទាន — តភ្ជាប់',
    steps: [
      {
        name: 'សម្គាល់រូបភាព',
        eyebrow: 'ចាប់ផ្តើមពីអ្វីដែលអ្នកមើលឃើញ',
        title: 'រូបភាពមួយបើកទ្វារដំបូង។',
        body: 'ផ្ទុកឡើង ឬថតរូបវត្ថុ ពិធីបុណ្យ ឬអាហារ ដើម្បីចាប់ផ្តើមការស្វែងយល់។',
        image: '/vision-samples/tuong_quan_the_am.jpg',
        imageAlt: 'ព្រះពោធិសត្វអវលោកិតេស្វរៈ',
        tags: ['រូបភាព', 'ប្រធានបទវប្បធម៌'],
      },
      {
        name: 'ពាក្យគន្លឹះ',
        eyebrow: 'ហៅឈ្មោះអ្វីដែលទើបបានរកឃើញ',
        title: 'ស្គាល់ពាក្យគន្លឹះសំខាន់ៗ។',
        body: 'រូបភាពនីមួយៗនាំទៅកាន់ពាក្យខ្មែរ ៣–៥ ពាក្យ មានន័យ សូរសព្ទ និងសំឡេងអាន។',
        image: '/vision-samples/amok_trey.jpg',
        imageAlt: 'អាម៉ុកត្រី',
        tags: ['អក្សរខ្មែរ', 'ន័យវៀតណាម', 'ស្តាប់សំឡេង'],
      },
      {
        name: 'ស្តាប់ និងអាន',
        eyebrow: 'វប្បធម៌រស់នៅក្នុងរឿងរ៉ាវ',
        title: 'តាមរឿងរ៉ាវដើម្បីយល់ពីបរិបទ។',
        body: 'រូបភាព និងពាក្យគន្លឹះត្រូវបានភ្ជាប់ជារឿងពីរភាសាដែលអាចស្តាប់ និងអានបាន។',
        image: '/vision-samples/ok_om_bok.jpg',
        imageAlt: 'ពិធីបុណ្យអកអំបុក',
        tags: ['ខ្មែរ ↔ វៀតណាម', 'សំឡេងនិទាន', 'រូបភាពរឿង'],
      },
      {
        name: 'ហាត់និយាយ',
        eyebrow: 'បំលែងអ្វីដែលបានរៀនទៅជាពាក្យសម្ដី',
        title: 'ស្តាប់ប្រយោគមួយ ហើយនិយាយតាម។',
        body: 'អ្នករៀនហាត់ប្រយោគខ្មែរទូទៅ និងទទួលមតិកែលម្អដើម្បីនិយាយដោយទំនុកចិត្ត។',
        image: '/vision-samples/chol_chnam_thmay.jpg',
        imageAlt: 'ពិធីបុណ្យចូលឆ្នាំថ្មី',
        tags: ['ប្រយោគទូទៅ', 'ថតសំឡេង', 'មតិកែលម្អ'],
      },
      {
        name: 'លទ្ធផល',
        eyebrow: 'ដំណើរមួយត្រូវបានបញ្ចប់',
        title: 'មើលឡើងវិញអ្វីដែលអ្នកបានយល់ និងនិយាយបាន។',
        body: 'លទ្ធផលភ្ជាប់បទពិសោធន៍ទាំងមូល និងបើកផ្លូវទៅសារមន្ទីរឌីជីថល។',
        image: '/vision-samples/angkor_wat.jpg',
        imageAlt: 'ស្ថាបត្យកម្មខ្មែរ',
        tags: ['វឌ្ឍនភាព', 'ស្វែងយល់បន្ត', 'សារមន្ទីរឌីជីថល'],
      },
    ],
  },
};

const SWIPE_THRESHOLD = 52;
const AUTO_ADVANCE_MS = 5200;

interface PointerStart {
  x: number;
  y: number;
  dragging: boolean;
}

export function CulturalIntroPage() {
  const router = useRouter();
  const { language } = useUiCopy();
  const content = INTRO_CONTENT[language];
  const [activeStep, setActiveStep] = useState(0);
  const [autoAdvancePaused, setAutoAdvancePaused] = useState(false);
  const [journeyVisible, setJourneyVisible] = useState(true);
  const journeyRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const doorsWrapperRef = useRef<HTMLDivElement>(null);
  const leftDoorRef = useRef<HTMLDivElement>(null);
  const rightDoorRef = useRef<HTMLDivElement>(null);
  const pageContentRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<PointerStart | null>(null);

  useEffect(() => {
    // Guard: GSAP ScrollTrigger requires browser APIs not available in SSR/test environments
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    gsap.registerPlugin(ScrollTrigger);

    // Grand Entrance "Door Opening" Animation — runs on all devices
    if (leftDoorRef.current && rightDoorRef.current && pageContentRef.current) {
      const tl = gsap.timeline({
        onComplete: () => {
          if (doorsWrapperRef.current) {
            doorsWrapperRef.current.style.display = 'none';
          }
        }
      });
      
      // On mobile: simpler entrance (no scale+brightness, just doors slide)
      const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      
      if (!isMobile) {
        gsap.set(pageContentRef.current, { scale: 1.05, filter: 'brightness(0)' });
        tl.to([leftDoorRef.current, rightDoorRef.current], {
          xPercent: (i) => i === 0 ? -100 : 100,
          duration: 1.8, ease: 'power4.inOut', delay: 0.2
        }, 0)
        .to(pageContentRef.current, {
          scale: 1, filter: 'brightness(1)',
          duration: 1.8, ease: 'power4.inOut'
        }, 0);
      } else {
        // Mobile: just slide doors, skip the expensive filter animation
        tl.to([leftDoorRef.current, rightDoorRef.current], {
          xPercent: (i) => i === 0 ? -100 : 100,
          duration: 1.2, ease: 'power3.inOut', delay: 0.1
        }, 0);
      }
    }

    // Desktop-only: Lenis smooth scroll + GSAP parallax
    // On mobile, native touch scroll is always faster than any JS-driven alternative
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    
    if (!isTouch) {
      const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      const lenisTickerFn = (time: number) => { lenis.raf(time * 1000); };
      gsap.ticker.add(lenisTickerFn);
      gsap.ticker.lagSmoothing(0);

      if (heroRef.current) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.5  // Slightly smoothed scrub for performance
          }
        });

        tl.to(heroRef.current.querySelector('.katha-intro-hero-copy'), {
          yPercent: 20, ease: 'none'
        }, 0);
        tl.to(heroRef.current.querySelector('.katha-intro-collage-main'), {
          yPercent: 35, ease: 'none'
        }, 0);
        tl.to(heroRef.current.querySelector('.katha-intro-collage-small'), {
          yPercent: -15, ease: 'none'
        }, 0);
        tl.to(heroRef.current.querySelector('.katha-intro-collage-note'), {
          yPercent: 60, ease: 'none'
        }, 0);
      }

      return () => {
        ScrollTrigger.getAll().forEach(st => st.kill());
        gsap.ticker.remove(lenisTickerFn);
        lenis.destroy();
      };
    }

    return () => {
      ScrollTrigger.getAll().forEach(st => st.kill());
    };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const journey = journeyRef.current;
    const root = rootRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === journey) {
            setJourneyVisible(entry.isIntersecting);
          } else {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-revealed');
            } else {
              // Remove the class when out of view so the animation repeats next time
              entry.target.classList.remove('is-revealed');
            }
          }
        });
      },
      { rootMargin: '-10% 0px -10% 0px', threshold: 0.05 },
    );

    if (journey) observer.observe(journey);

    // Scope to component root to avoid touching unrelated DOM elements
    const revealElements = root
      ? root.querySelectorAll('.reveal-on-scroll')
      : document.querySelectorAll('.reveal-on-scroll');
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (autoAdvancePaused || !journeyVisible) return;
    const timer = window.setTimeout(() => {
      setActiveStep((currentStep) => (currentStep + 1) % content.steps.length);
    }, AUTO_ADVANCE_MS);

    return () => window.clearTimeout(timer);
  }, [activeStep, autoAdvancePaused, content.steps.length, journeyVisible]);

  function goToStep(nextStep: number) {
    setActiveStep(Math.max(0, Math.min(content.steps.length - 1, nextStep)));
  }

  function openArea(nextPath = '/admin/vision') {
    router.push(nextPath);
  }

  function scrollToJourney() {
    journeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startSwipe(event: PointerEvent<HTMLDivElement>) {
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      dragging: false,
    };
  }

  function moveSwipe(event: PointerEvent<HTMLDivElement>) {
    const pointerStart = pointerStartRef.current;
    if (!pointerStart) return;

    const distanceX = event.clientX - pointerStart.x;
    const distanceY = event.clientY - pointerStart.y;
    if (!pointerStart.dragging) {
      if (Math.abs(distanceX) < 8 || Math.abs(distanceX) <= Math.abs(distanceY) * 1.15) {
        return;
      }
      pointerStart.dragging = true;
      setAutoAdvancePaused(true);
      event.currentTarget.classList.add('is-dragging');
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    event.preventDefault();
    event.currentTarget.style.transform =
      `translate3d(calc(-${activeStep * 100}% + ${distanceX}px), 0, 0)`;
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const pointerStart = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!pointerStart?.dragging) return;

    const distance = event.clientX - pointerStart.x;
    const direction = Math.abs(distance) >= SWIPE_THRESHOLD ? (distance < 0 ? 1 : -1) : 0;
    const nextStep =
      (activeStep + direction + content.steps.length) % content.steps.length;

    event.currentTarget.classList.remove('is-dragging');
    event.currentTarget.style.transform = `translate3d(-${nextStep * 100}%, 0, 0)`;
    setActiveStep(nextStep);
    setAutoAdvancePaused(false);
  }

  function cancelSwipe(event: PointerEvent<HTMLDivElement>) {
    const wasDragging = pointerStartRef.current?.dragging;
    pointerStartRef.current = null;
    if (!wasDragging) return;
    event.currentTarget.classList.remove('is-dragging');
    event.currentTarget.style.transform = `translate3d(-${activeStep * 100}%, 0, 0)`;
    setAutoAdvancePaused(false);
  }

  function resumeAfterFocus(event: FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setAutoAdvancePaused(false);
  }

  return (
    <main ref={rootRef} className="katha-cultural-intro min-h-dvh bg-katha-surface text-katha-text">
      {/* Cinematic Grand Entrance Doors */}
      <div ref={doorsWrapperRef} className="katha-grand-doors" aria-hidden="true">
        <div ref={leftDoorRef} className="katha-door katha-door-left">
          <div className="katha-door-accent"></div>
        </div>
        <div ref={rightDoorRef} className="katha-door katha-door-right">
          <div className="katha-door-accent"></div>
        </div>
      </div>

      <FloatingParticles />
      <div className="katha-intro-pattern" aria-hidden="true" />
      <div ref={pageContentRef} className="katha-intro-shell">
        <section ref={heroRef} className="katha-intro-hero reveal-on-scroll">
          <div className="katha-intro-hero-copy">
            <div className="katha-intro-badge">
              <span className="katha-intro-badge-dot" />
              <span>{content.heroBadge}</span>
            </div>
            <p className="katha-intro-eyebrow">{content.heroEyebrow}</p>
            <h1>
              {content.heroTitleFirst}
              <span>{content.heroTitleAccent}</span>
            </h1>
            <p className="katha-intro-lead">{content.heroBody}</p>
            <div className="katha-intro-hero-actions">
              <button
                type="button"
                className="katha-intro-button katha-intro-button-primary"
                onClick={scrollToJourney}
              >
                {content.startJourney} <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                className="katha-intro-button"
                onClick={() => openArea('/admin/museum')}
              >
                {content.visitMuseum}
              </button>
            </div>
          </div>

          <div className="katha-intro-collage reveal-on-scroll" aria-label={content.livingCulture}>
            <div className="katha-intro-collage-badge katha-intro-collage-badge-tr">
              <span>✨ AI Vision</span>
              <strong>{language === 'km' ? 'ពិធីបុណ្យអកអំបុក' : 'Lễ hội Ok Om Bok'}</strong>
            </div>

            <div className="katha-intro-collage-main">
              <Image
                src="/vision-samples/ok_om_bok.jpg"
                alt="Ok Om Bok"
                fill
                priority
                loading="eager"
                sizes="(max-width: 900px) 92vw, 48vw"
              />
            </div>
            <div className="katha-intro-collage-small">
              <Image
                src="/vision-samples/amok_trey.jpg"
                alt="Amok trey"
                fill
                priority
                sizes="(max-width: 900px) 38vw, 18vw"
              />
            </div>
            <div className="katha-intro-collage-note">
              <small>{content.livingCulture}</small>
              <strong>{content.livingCultureBody}</strong>
            </div>
          </div>
        </section>

        {/* Modern Stats / Metrics Strip */}
        <section className="katha-intro-stats reveal-on-scroll" aria-label="Katha Highlights">
          {content.stats.map((stat) => (
            <div key={stat.label} className="katha-intro-stat-card">
              <strong className="katha-intro-stat-value">{stat.value}</strong>
              <h3 className="katha-intro-stat-label">{stat.label}</h3>
              <p className="katha-intro-stat-desc">{stat.desc}</p>
            </div>
          ))}
        </section>

        {/* Four Pillars Bento Grid */}
        <section className="katha-intro-pillars reveal-on-scroll">
          <div className="katha-intro-pillars-header">
            <p className="katha-intro-eyebrow">{content.pillarsEyebrow}</p>
            <h2>{content.pillarsTitle}</h2>
            <p className="katha-intro-pillars-lead">{content.pillarsSubtitle}</p>
          </div>

          <div className="katha-intro-pillars-grid">
            {content.pillars.map((pillar, idx) => (
              <article
                key={pillar.title}
                className={`katha-intro-pillar-card katha-intro-pillar-card-${idx + 1}`}
                onClick={() => openArea(pillar.href)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openArea(pillar.href);
                  }
                }}
              >
                <div className="katha-intro-pillar-image">
                  <Image
                    src={pillar.image}
                    alt={pillar.imageAlt}
                    fill
                    sizes="(max-width: 900px) 100vw, 55vw"
                    loading="lazy"
                  />
                  <div className="katha-intro-pillar-overlay" />
                </div>
                <div className="katha-intro-pillar-content">
                  <span className="katha-intro-pillar-tag">{pillar.tag}</span>
                  <h3>{pillar.title}</h3>
                  <p className="katha-intro-pillar-sub">{pillar.subtitle}</p>
                  <p className="katha-intro-pillar-body">{pillar.body}</p>
                  <div className="katha-intro-pillar-action">
                    <span>{pillar.actionText}</span>
                    <span aria-hidden="true">→</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="katha-intro-purpose reveal-on-scroll">
          <div>
            <p className="katha-intro-eyebrow">{content.purposeEyebrow}</p>
            <h2>{content.purposeTitle}</h2>
          </div>
          <div className="katha-intro-purpose-grid">
            {content.purposes.map((purpose, index) => (
              <article key={purpose.title} className="reveal-on-scroll" style={{ transitionDelay: `${index * 150}ms` }}>
                <div className="katha-intro-purpose-icon">
                  {index === 0 && (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </svg>
                  )}
                  {index === 1 && (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                      <path d="M6 6h10M6 10h10" />
                    </svg>
                  )}
                  {index === 2 && (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                  )}
                </div>
                <b>{String(index + 1).padStart(2, '0')}</b>
                <strong>{purpose.title}</strong>
                <p>{purpose.body}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="katha-intro-marquee reveal-on-scroll" aria-label={content.marquee}>
          <div className="katha-intro-marquee-track" aria-hidden="true">
            {[0, 1].map((group) => (
              <div className="katha-intro-marquee-group" key={group}>
                {[0, 1, 2].map((item) => (
                  <span key={item}>{content.marquee}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section ref={journeyRef} className="katha-intro-journey">
          <header className="katha-intro-journey-heading reveal-on-scroll">
            <div>
              <p className="katha-intro-eyebrow">{content.journeyEyebrow}</p>
              <h2>{content.journeyTitle}</h2>
            </div>
            <p className="katha-intro-counter" aria-live="polite">
              <strong>{String(activeStep + 1).padStart(2, '0')}</strong> /{' '}
              {String(content.steps.length).padStart(2, '0')}
            </p>
          </header>

          <div
            className="katha-intro-stage reveal-on-scroll"
            aria-label={content.journeyAria}
            onMouseEnter={() => setAutoAdvancePaused(true)}
            onMouseLeave={() => setAutoAdvancePaused(false)}
            onFocusCapture={() => setAutoAdvancePaused(true)}
            onBlurCapture={resumeAfterFocus}
          >
            <div
              className="katha-intro-track"
              style={{ transform: `translate3d(-${activeStep * 100}%, 0, 0)` }}
              onPointerDown={startSwipe}
              onPointerMove={moveSwipe}
              onPointerUp={finishSwipe}
              onPointerCancel={cancelSwipe}
            >
              {content.steps.map((step, index) => (
                <article
                  key={step.name}
                  className={`katha-intro-slide ${index === activeStep ? 'is-active' : ''}`}
                  aria-hidden={index !== activeStep}
                >
                  <div className="katha-intro-slide-image">
                    <Image
                      src={step.image}
                      alt={step.imageAlt}
                      fill
                      priority={index === 0 || step.image.includes('ok_om_bok')}
                      sizes="(max-width: 900px) 100vw, 62vw"
                    />
                    <span className="katha-intro-stage-badge">
                      <i aria-hidden="true" /> {step.name}
                    </span>
                  </div>
                  <div className="katha-intro-slide-copy">
                    <span className="katha-intro-step-number">
                      {content.stepLabel} {String(index + 1).padStart(2, '0')}
                    </span>
                    <p className="katha-intro-eyebrow">{step.eyebrow}</p>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                    <div className="katha-intro-tags">
                      {step.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <button
              type="button"
              className="katha-intro-arrow katha-intro-arrow-left"
              onClick={() =>
                goToStep((activeStep - 1 + content.steps.length) % content.steps.length)
              }
              aria-label={content.previousStep}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="katha-intro-arrow katha-intro-arrow-right"
              onClick={() => goToStep((activeStep + 1) % content.steps.length)}
              aria-label={content.nextStep}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <nav className="katha-intro-flow reveal-on-scroll" aria-label={content.journeyAria}>
            {content.steps.map((step, index) => (
              <button
                key={step.name}
                type="button"
                className={`${index === activeStep ? 'is-active' : ''} ${
                  index < activeStep ? 'is-done' : ''
                }`}
                aria-current={index === activeStep ? 'step' : undefined}
                onClick={() => goToStep(index)}
              >
                <i aria-hidden="true" />
                <span>{step.name}</span>
                <small>{String(index + 1).padStart(2, '0')}</small>
              </button>
            ))}
          </nav>
        </section>

        <section className="katha-intro-footer-cta reveal-on-scroll">
          <div className="katha-intro-footer-glow" aria-hidden="true" />
          <div className="katha-intro-footer-content">
            <p className="katha-intro-eyebrow">{content.heroEyebrow}</p>
            <blockquote>“{content.footerQuote}”</blockquote>
            <div className="katha-intro-footer-actions">
              <button
                type="button"
                className="katha-intro-button katha-intro-button-primary"
                onClick={() => openArea()}
              >
                {content.enter} <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="katha-intro-footer-badges">
              <span>✦ Đa phương tiện AI</span>
              <span>✦ Song ngữ Khmer - Việt</span>
              <span>✦ Di sản số tương tác</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
