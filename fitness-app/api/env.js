module.exports = function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || 'https://ougpvpolmzsmaljscruo.supabase.co',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'sb_publishable_yMc2R_eToKBVsPACsyYWpg_rVQYZoDV'
  });
};
