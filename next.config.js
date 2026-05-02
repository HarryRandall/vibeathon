/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    const id = '7624';
    return [
      { source: '/assistant', destination: `/courses/${id}/assistant`, permanent: false },
      { source: '/materials', destination: `/courses/${id}/materials`, permanent: false },
      { source: '/quizzes', destination: `/courses/${id}/quizzes`, permanent: false },
    ];
  },
};

module.exports = nextConfig;
