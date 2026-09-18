import { http, HttpResponse } from 'msw'

export const handlers = [
  // Example: Mock external API calls if needed
  // Add your API mocks here as needed
  http.get('https://api.example.com/external', () => {
    return HttpResponse.json({ data: 'mocked' })
  }),
]
