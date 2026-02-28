const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

function timestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

const logger = {
    info(module, message, data) {
        console.log(`${colors.gray}${timestamp()}${colors.reset} ${colors.cyan}[${module}]${colors.reset} ${message}`, data || '');
    },
    success(module, message, data) {
        console.log(`${colors.gray}${timestamp()}${colors.reset} ${colors.green}✓ [${module}]${colors.reset} ${message}`, data || '');
    },
    warn(module, message, data) {
        console.log(`${colors.gray}${timestamp()}${colors.reset} ${colors.yellow}⚠ [${module}]${colors.reset} ${message}`, data || '');
    },
    error(module, message, data) {
        console.error(`${colors.gray}${timestamp()}${colors.reset} ${colors.red}✗ [${module}]${colors.reset} ${message}`, data || '');
    },
    demo(module, message, data) {
        console.log(`${colors.gray}${timestamp()}${colors.reset} ${colors.magenta}🎭 [DEMO:${module}]${colors.reset} ${message}`, data || '');
    },
    step(step, total, message) {
        console.log(`${colors.gray}${timestamp()}${colors.reset} ${colors.bright}${colors.blue}[${step}/${total}]${colors.reset} ${message}`);
    }
};

module.exports = logger;
