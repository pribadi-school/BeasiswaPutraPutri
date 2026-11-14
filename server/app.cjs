// Startup file untuk cPanel → Setup Node.js App (Passenger memuat file CommonJS).
// Kode server sebenarnya adalah ES module hasil build di server-dist/.
import('../server-dist/server/index.js').catch((err) => {
  console.error('Server gagal dimulai:', err);
  process.exit(1);
});
