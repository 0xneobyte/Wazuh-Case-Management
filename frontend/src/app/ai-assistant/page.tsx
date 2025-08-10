'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { aiAPI, casesAPI, handleAPIError } from '@/services/api';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}


interface CaseSummary {
  _id: string;
  caseId: string;
  title: string;
  priority: string;
  status: string;
}

export default function AIAssistantPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('chat');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user) {
      loadCases();
      // Add welcome message
      setMessages([{
        role: 'assistant',
        content: `Hello ${user.firstName}! I'm your AI security assistant. I can help you with:

• **Case Analysis**: Get insights into specific security cases
• **Remediation Guidance**: Receive step-by-step remediation recommendations
• **MITRE ATT&CK Mapping**: Understand attack techniques and tactics
• **Executive Summaries**: Generate reports for stakeholders

How can I assist you today?`,
        timestamp: new Date()
      }]);
    }
  }, [user, isLoading, router]);

  const loadCases = async () => {
    try {
      // Get all cases first, then filter on frontend since backend doesn't support multiple status values
      const response = await casesAPI.getCases({ 
        page: 1, 
        limit: 100, 
        sort: '-createdAt'
      });

      if (response.success) {
        // Filter for only active cases (Open and In Progress)
        const activeCases = response.data.filter((case_: any) => 
          case_.status === 'Open' || case_.status === 'In Progress'
        );
        
        setCases(activeCases.map((case_: any) => ({
          _id: case_._id,
          caseId: case_.caseId,
          title: case_.title,
          priority: case_.priority,
          status: case_.status
        })));
      }
    } catch (error) {
      console.error('Error loading cases:', error);
      const apiError = handleAPIError(error);
      setError(`Failed to load cases: ${apiError.message}`);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsProcessing(true);
    setError(null);

    try {
      const response = await aiAPI.generateResponse({
        message: inputMessage,
        context: selectedCaseId ? { caseId: selectedCaseId } : undefined
      });

      if (response.success) {
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error?.message || 'Failed to get AI response');
      }
    } catch (error) {
      console.error('AI response error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
      
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const requestAnalysis = async (type: 'remediation' | 'mitre' | 'executive') => {
    if (!selectedCaseId) {
      setError('Please select a case first');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let response;
      
      switch (type) {
        case 'remediation':
          response = await aiAPI.getRemediationSteps(selectedCaseId);
          break;
          
        case 'mitre':
          response = await aiAPI.getMITREAnalysis(selectedCaseId);
          break;
          
        case 'executive':
          response = await aiAPI.getExecutiveSummary(selectedCaseId);
          break;
      }

      if (response.success) {
        let content = '';
        
        // Handle different response formats from Gemini API
        if (response.data.suggestions && Array.isArray(response.data.suggestions)) {
          // Format structured suggestions
          content = response.data.suggestions.map(suggestion => {
            return `## ${suggestion.category}\n\n${suggestion.items.map(item => `• ${item}`).join('\n')}`;
          }).join('\n\n');
        } else {
          // Fallback to other content formats
          content = response.data.analysis || response.data.response || response.data.summary || response.data.rawResponse || 'No response received';
        }
        
        const analysisMessage: AIMessage = {
          role: 'assistant',
          content,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, analysisMessage]);
        setActiveTab('chat'); // Switch to chat tab to show results
      } else {
        throw new Error(response.error?.message || `${type} analysis failed`);
      }

    } catch (error) {
      console.error('Analysis error:', error);
      const apiError = handleAPIError(error);
      setError(`Analysis failed: ${apiError.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const exportToPDF = async (content: string, caseId: string) => {
    try {
      // Create a temporary div with the markdown content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '20px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.position = 'absolute';
      tempDiv.style.top = '-9999px';
      tempDiv.style.left = '-9999px';
      
      document.body.appendChild(tempDiv);
      
      // Convert to canvas
      const canvas = await html2canvas(tempDiv, {
        width: 840,
        height: tempDiv.scrollHeight,
        scale: 2
      });
      
      // Remove temp div
      document.body.removeChild(tempDiv);
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      const imgData = canvas.toDataURL('image/png');
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Save PDF
      pdf.save(`Executive-Report-${caseId}-${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-3">
            <SparklesIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">AI Security Assistant</h1>
              <p className="mt-1 text-sm text-gray-600">
                Get intelligent insights and recommendations for your security cases
              </p>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <p>Error: {error}</p>
              <button 
                onClick={() => setError(null)}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Case Selection & Analysis Tools */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 py-2 px-4 text-sm font-medium text-center border-b-2 ${
                      activeTab === 'chat'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <ChatBubbleLeftRightIcon className="h-4 w-4 inline mr-1" />
                    Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('analysis')}
                    className={`flex-1 py-2 px-4 text-sm font-medium text-center border-b-2 ${
                      activeTab === 'analysis'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <DocumentTextIcon className="h-4 w-4 inline mr-1" />
                    Analysis
                  </button>
                </nav>
              </div>

              <div className="p-4">
                {activeTab === 'analysis' && (
                  <>
                    {/* Case Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Case for Analysis
                      </label>
                      <select
                        value={selectedCaseId}
                        onChange={(e) => setSelectedCaseId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Choose a case...</option>
                        {cases.map((case_) => (
                          <option key={case_._id} value={case_._id}>
                            {case_.caseId} - {case_.title} ({case_.priority})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Analysis Options */}
                    <div className="space-y-3">
                      <button
                        onClick={() => requestAnalysis('remediation')}
                        disabled={!selectedCaseId || isProcessing}
                        className="w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center space-x-2">
                          <ShieldCheckIcon className="h-5 w-5 text-green-600" />
                          <div>
                            <h4 className="font-medium text-gray-900">Remediation Steps</h4>
                            <p className="text-xs text-gray-600">Get actionable fix recommendations</p>
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => requestAnalysis('mitre')}
                        disabled={!selectedCaseId || isProcessing}
                        className="w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center space-x-2">
                          <MagnifyingGlassIcon className="h-5 w-5 text-purple-600" />
                          <div>
                            <h4 className="font-medium text-gray-900">MITRE Analysis</h4>
                            <p className="text-xs text-gray-600">Map to ATT&CK framework</p>
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => requestAnalysis('executive')}
                        disabled={!selectedCaseId || isProcessing}
                        className="w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center space-x-2">
                          <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                          <div>
                            <h4 className="font-medium text-gray-900">Executive Summary</h4>
                            <p className="text-xs text-gray-600">Generate leadership report</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                )}

                {activeTab === 'chat' && (
                  <div className="text-center py-8">
                    <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">
                      Use the chat interface to ask questions and get AI assistance with your security cases.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Chat Interface */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow flex flex-col h-[600px]">
              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-3xl rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div>
                          <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-ul:text-gray-800 prose-li:text-gray-800">
                            <ReactMarkdown>
                              {String(message.content || 'No response received')}
                            </ReactMarkdown>
                          </div>
                          {message.content?.includes('# Security Incident Executive Report') && (
                            <div className="mt-3 pt-2 border-t border-gray-200">
                              <button
                                onClick={() => {
                                  const selectedCase = cases.find(c => c._id === selectedCaseId);
                                  exportToPDF(message.content, selectedCase?.caseId || 'Unknown');
                                }}
                                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" />
                                Export as PDF
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content || ''}</div>
                      )}
                      <div className={`text-xs mt-1 ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2">
                      <div className="flex items-center space-x-2">
                        <ClockIcon className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-gray-600">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me about security cases, threat analysis, or remediation steps..."
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Press Enter to send • Shift+Enter for new line
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}