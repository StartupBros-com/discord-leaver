import ora from 'ora';

export function handleError(error, context) {
  const errorMessage = error.response?.data?.message || error.message;
  console.error(`Error in ${context}:`, errorMessage);
  return {
    success: false,
    error: errorMessage
  };
}

export function createSpinner(text) {
  return ora({
    text,
    spinner: 'dots',
    color: 'cyan'
  });
}