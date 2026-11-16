/** Tipe data bersama. */
export const STATUSES = ['pending', 'lulus', 'cadangan', 'tidak_lulus'];
export const STAGES = ['admin', 'test', 'interview'];
export const STAGE_RESULTS = ['pending', 'lulus', 'tidak_lulus'];
const blank = () => ({ id: '', en: '' });
export const emptyStageSettings = () => ({ publishAt: null, info: blank(), pass: blank(), fail: blank() });
export const emptyStages = () => ({ admin: emptyStageSettings(), test: emptyStageSettings(), interview: emptyStageSettings() });
/** Kesalahan yang bisa ditampilkan ke pengguna. `code` dipetakan ke teks di i18n. */
export class AppError extends Error {
    code;
    field;
    constructor(code, field) {
        super(code);
        this.code = code;
        this.field = field;
    }
}
export const emptyProfile = () => ({
    level: '', fullName: '', gender: '', birthPlace: '', birthDate: '', nisn: '',
    province: 'Jawa Barat', regency: '', district: '', address: '', originSchool: '', originClass: '',
    parentName: '', parentRelation: '', parentPhone: '', parentEmail: '', parentJob: '',
    incomeBand: '', siblings: '', achievements: '', motivation: '',
});
