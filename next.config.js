/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    const id = '7624';
    return [
      { source: '/assistant', destination: `/courses/${id}/assistant`, permanent: false },
      { source: '/materials', destination: `/courses/${id}/materials`, permanent: false },
      { source: '/quizzes', destination: `/courses/${id}/assistant?tab=quiz`, permanent: false },
      // Old per-course /quizzes route → Study Assistant with Practice quiz tab pre-selected.
      { source: '/courses/:courseId/quizzes', destination: '/courses/:courseId/assistant?tab=quiz', permanent: false },
    ];
  },
};

module.exports = nextConfig;
