/** 26 Des 2026 23.59 WIB. */
export const DEFAULT_REG_DEADLINE = '2026-12-26T16:59:00.000Z';
/** 20 Jan 2027 09.00 WIB. */
export const DEFAULT_ANNOUNCE_AT = '2027-01-20T02:00:00.000Z';
export const defaultStages = () => ({
    admin: {
        publishAt: null,
        info: {
            id: 'Pemeriksaan data dan berkas kelengkapan setelah pendaftaran ditutup (26 Desember 2026).',
            en: 'Review of the registration data and documents after registration closes (26 December 2026).',
        },
        pass: {
            id: 'Selamat, ananda lolos seleksi administrasi dan berhak mengikuti Tes Akademik & Tes IQ.',
            en: 'Congratulations, your child passed the administrative selection and may take the Academic & IQ test.',
        },
        fail: {
            id: 'Mohon maaf, ananda belum lolos seleksi administrasi. Terima kasih atas partisipasinya.',
            en: 'We are sorry, your child did not pass the administrative selection. Thank you for taking part.',
        },
    },
    test: {
        publishAt: null,
        info: {
            id: 'Sabtu, 9 Januari 2027. Waktu dan tempat diinformasikan panitia.',
            en: 'Saturday, 9 January 2027. Time and place will be announced by the committee.',
        },
        pass: {
            id: 'Selamat, ananda lolos Tes Akademik & Tes IQ dan berhak mengikuti Interview.',
            en: 'Congratulations, your child passed the Academic & IQ test and may attend the interview.',
        },
        fail: {
            id: 'Mohon maaf, ananda belum lolos Tes Akademik & Tes IQ. Terima kasih atas partisipasinya.',
            en: 'We are sorry, your child did not pass the Academic & IQ test. Thank you for taking part.',
        },
    },
    interview: {
        publishAt: null,
        info: {
            id: 'Sabtu, 16 Januari 2027. Waktu dan tempat diinformasikan panitia.',
            en: 'Saturday, 16 January 2027. Time and place will be announced by the committee.',
        },
        pass: {
            id: 'Terima kasih telah mengikuti interview. Hasil akhir diumumkan 20 Januari 2027.',
            en: 'Thank you for attending the interview. The final result will be announced on 20 January 2027.',
        },
        fail: {
            id: 'Mohon maaf, ananda belum lolos tahap interview. Terima kasih atas partisipasinya.',
            en: 'We are sorry, your child did not pass the interview stage. Thank you for taking part.',
        },
    },
});
