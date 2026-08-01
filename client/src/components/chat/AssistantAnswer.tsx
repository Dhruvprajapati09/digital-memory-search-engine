import { formatChatAnswer } from '../../utils/formatChatAnswer'

interface AssistantAnswerProps {
  content: string
}

function AssistantAnswer({ content }: AssistantAnswerProps) {
  return formatChatAnswer(content)
}

export default AssistantAnswer
