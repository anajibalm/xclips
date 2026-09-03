Perbedaan utamanya ada pada model interaksi dan state management:

/v1/chat/completions (standar lama, masih didukung)

Stateless — kamu harus kirim ulang seluruh riwayat percakapan (array messages) di setiap requestkarena kamu perlu menyimpan sendiri catatan percakapan saat ini, mengirim kembali salinan lengkapnya setiap kali ada prompt baru 
Simon Willison
Format datanya flat: satu tipe objek (message dengan role) menampung semua hal — teks, tool call, hasil toolsatu tipe objek membawa semua hal — teks, tool call, hasil tool, dibedakan lewat role 
AI Engineering
Tool calling harus di-loop manual sampai selesai, tidak ada built-in tools

/v1/responses (API baru, direkomendasikan OpenAI untuk project baru)

Bisa stateful — server menyimpan riwayat percakapan, kamu tinggal kirim previous_response_id tanpa perlu resend seluruh historiAPI Responses punya kompatibilitas dengan Conversations API untuk percakapan persisten, atau kemampuan mengirim previous_response_id untuk merangkai Responses dengan mudah 
OpenAI Developers
Struktur output berupa item bertipe (message, reasoning, function_call, function_call_output), bukan flat messagesResponses memberi item bertipe: message, reasoning, function_call, function_call_output 
AI Engineering
Ada built-in tools (web search, file search, code interpreter, computer use, remote MCP)API Responses berisi tools bawaan seperti pencarian web, pencarian file, computer use, code interpreter, dan MCP jarak jauh 
OpenAI Developers
Untuk model reasoning (GPT-5 dst), konteks reasoning tetap terjaga antar-turn, sedangkan di Chat Completions token reasoning dibuang setiap turn selesaiToken reasoning dari model seperti o3 dan o4-mini dibuang antar-turn, menurunkan performa pada tugas agentic 
The New Stack

Kapan pakai yang mana:

Chat Completions — cocok untuk chatbot/text generation sederhana, atau kalau kamu pakai framework abstraksi lintas provider (LangChain, LlamaIndex) dan portabilitas antar-vendor pentingIni pilihan default yang tepat kalau kamu menggunakan framework seperti LangChain atau LlamaIndex yang mengabstraksi antar provider, atau kalau portabilitas lintas-provider penting 
Portkey
Responses — pilih untuk agent otonom, multi-step tool use, atau workflow agentic yang butuh state server-sidePilih ini ketika kamu membangun agent otonom yang menggunakan tools bawaan, atau workflow multi-turn di mana kamu ingin mengurangi overhead token antar-turn 
Portkey

Catatan untuk kompatibilitas OpenAI-compatible API: banyak provider pihak ketiga (termasuk beberapa yang meng-implement "OpenAI-compatible") mengadopsi endpoint /v1/chat/completions dan /v1/responses ala OpenAI — mereka mengadopsi antarmukanya, bukan layanannya secara langsung, tapi tidak semua provider sudah mengimplementasikan /v1/responses — jadi kalau kamu integrasi ke provider non-OpenAI (misalnya untuk Masagi atau tarum-signals), cek dulu apakah endpoint itu benar-benar tersedia sebelum migrasi. 
AI Engineering