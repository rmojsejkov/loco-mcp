export const createPoContent = (
  assetId = 'Retry',
  translation = 'Retry'
): string => `msgid ""
msgstr ""
"Project-Id-Version: student-native 5.0.0\\n"
"Language: de_DE\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

#. Learning Gaps exercise retry action shown after a failed answer
#: app/example.tsx:10
#, fuzzy
msgctxt "Button on a Learning Gaps exercise card that starts the exercise again"
msgid "${assetId}"
msgstr "${translation}"
`;
