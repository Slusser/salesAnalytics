const TEST_USER_EMAIL = process.env['TEST_USER_EMAIL'] ?? '';
const TEST_USER_PASSWORD = process.env['TEST_USER_PASSWORD'] ?? '';

export const hasTestUserCredentials =
  Boolean(TEST_USER_EMAIL) && Boolean(TEST_USER_PASSWORD);

export type TestUserCredentials = {
  email: string;
  password: string;
};

const defaultErrorMessage =
  'Ustaw TEST_USER_EMAIL i TEST_USER_PASSWORD, aby uruchomić ten scenariusz.';

export const ensureTestUserCredentials = (
  customMessage?: string
): TestUserCredentials => {
  if (!hasTestUserCredentials) {
    throw new Error(customMessage ?? defaultErrorMessage);
  }

  return {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  };
};

export const describeSkipMessage = defaultErrorMessage;


