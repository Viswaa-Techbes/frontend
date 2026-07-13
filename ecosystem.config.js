module.exports = {
  apps: [
    {
      name: 'techbes-billing-api',
      script: 'server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'techbes-billing-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PORT: 3000,
        NODE_ENV: 'production',
      },
    },
  ],
};
