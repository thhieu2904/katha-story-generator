const VISION_SAMPLE_IMAGE_BY_CLASS: Readonly<Record<string, string>> = {
  amok_trey: '/vision-samples/amok_trey.jpg',
  angkor_wat: '/vision-samples/angkor_wat.jpg',
  bayon_face_tower: '/vision-samples/bayon_face_tower.jpg',
  chapei_dang_veng: '/vision-samples/chapei_dang_veng.jpg',
  chol_chnam_thmay: '/vision-samples/chol_chnam_thmay.jpg',
  com_dep_khmer: '/vision-samples/com_dep_khmer.jpg',
  du_ke: '/vision-samples/du_ke.jpg',
  kathina_khmer: '/vision-samples/kathina_khmer.jpg',
  krama: '/vision-samples/krama.jpg',
  lakhon_khol: '/vision-samples/lakhon_khol.jpg',
  naga_7_dau: '/vision-samples/naga_7_dau.jpg',
  num_ansom: '/vision-samples/num_ansom.jpg',
  ok_om_bok: '/vision-samples/ok_om_bok.jpg',
  pinpeat: '/vision-samples/pinpeat.jpg',
  sbek_thom: '/vision-samples/sbek_thom.jpg',
  tuong_quan_the_am: '/vision-samples/tuong_quan_the_am.jpg',
};

export function getVisionSampleImage(className: string): string | null {
  return VISION_SAMPLE_IMAGE_BY_CLASS[className] ?? null;
}
