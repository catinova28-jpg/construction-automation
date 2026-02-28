module.exports = {
    apps: [{
        name: 'construction-bot',
        script: 'server.js',
        cwd: '/opt/construction-automation',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production',
            PORT: 3000,
        },
        // Логи
        error_file: '/opt/construction-automation/logs/error.log',
        out_file: '/opt/construction-automation/logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        merge_logs: true,
        // Перезапуск при крашах
        restart_delay: 5000,
        max_restarts: 10,
    }],
};
