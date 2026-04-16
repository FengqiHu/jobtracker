module.exports = {
  apps: [
    {
      name: "job-tracker",
      script: "./dist/index.js",
      cwd: "./backend",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      log_file: "../logs/combined.log",
      out_file: "../logs/out.log",
      error_file: "../logs/error.log",
      time: true
    }
  ]
}
