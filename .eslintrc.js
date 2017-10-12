module.exports = {
  'extends': 'airbnb',
  'env': {
    'browser': true,
  },
  'rules': {
    'comma-dangle': ['error', {
      'functions': 'ignore',
      'arrays': 'only-multiline',
      'objects': 'only-multiline',
    }],
    'no-bitwise': 'off',
    'no-plusplus': 'off',
    'no-underscore-dangle': ['error', { 'allowAfterThis': true }],
    'no-restricted-syntax': [
      'error',
      'ForInStatement',
      'LabeledStatement',
      'WithStatement',
    ],
    'import/prefer-default-export': 'off',
    'function-paren-newline': 'off',
  },
};
