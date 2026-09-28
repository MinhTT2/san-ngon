# Sân Ngon — giải thích kỹ thuật để trình bày với thầy

Dành cho người không chuyên IT. Đối chiếu với mã nguồn và tài liệu dự án ngày 28/09/2026; đây không phải biên bản xác nhận hệ thống đã chạy ổn trên môi trường thật.

Cách dùng: đọc phần 1 để tập nói, đọc phần 2 để hiểu, dùng phần 4 khi thầy hỏi. Không cần học thuộc tên hàm hoặc đọc mã nguồn. Đại từ “nhóm em” trong bài mẫu có thể đổi cho đúng người trình bày.

## 1. Bài nói mẫu khoảng 3 phút

“Sân Ngon là website hỗ trợ đặt sân bóng đá, cầu lông và pickleball tại Hà Nội. Mục tiêu là giúp người chơi tìm giờ còn sân và đặt trực tuyến, đồng thời giúp chủ sân quản lý lịch tập trung, giảm việc phải nhận điện thoại và ghi chép thủ công.

Website có ba nhóm người dùng. Người chơi tìm và đặt sân. Chủ sân quản lý sân, giá, lịch và đơn đặt. Quản trị viên xét duyệt hồ sơ chủ sân và quản lý hoạt động của hệ thống.

Về kỹ thuật, có thể hình dung hệ thống gồm ba phần. Phần giao diện là thứ người dùng nhìn thấy và bấm vào. Phần xử lý tiếp nhận yêu cầu, kiểm tra người dùng và dữ liệu nhập. Phần cơ sở dữ liệu lưu thông tin và thực hiện những quy tắc quan trọng như tính giá, giữ chỗ và xác nhận thanh toán.

Nhóm sử dụng Next.js để xây dựng website, Supabase để hỗ trợ lưu trữ dữ liệu, đăng nhập và cập nhật trạng thái; SePay để nhận thông báo chuyển khoản. Website được triển khai qua Vercel. Cách làm này giúp nhóm nhỏ tập trung vào chức năng đặt sân và giảm khối lượng tự vận hành máy chủ.

Điểm kỹ thuật quan trọng nhất là chống đặt trùng. Ví dụ, hai người cùng chọn sân số 1 từ 18 giờ đến 19 giờ. Dù cả hai cùng nhìn thấy sân trống, cơ sở dữ liệu chỉ cho phép một đơn giữ chỗ thành công. Người còn lại phải chọn sân hoặc giờ khác.

Khi tạo đơn, hệ thống tự tính lại giá theo bảng giá của sân. Người dùng không thể quyết định số tiền phải trả bằng cách sửa con số trên màn hình. Đơn được giữ chỗ trong 15 phút để chuyển khoản. Với đơn mới, số tiền cần chuyển hiện bằng 100% tiền sân.

Sau khi khách chuyển khoản, SePay gửi thông báo về hệ thống. Hệ thống kiểm tra mã đơn, số tiền, tài khoản nhận và giao dịch trước khi xác nhận. Trang thanh toán có thể tự cập nhật kết quả mà người dùng không phải liên tục tải lại. Nếu thông báo giao dịch bị gửi lại, hệ thống có cơ chế tránh ghi nhận trùng.

Về quyền truy cập, người chơi xem đơn của mình, chủ sân quản lý phần sân của mình, còn quản trị viên có quyền xét duyệt. Những giới hạn này được kiểm tra cả ở cơ sở dữ liệu, chứ không chỉ dựa vào việc ẩn nút trên giao diện.

Đây là bản sản phẩm khả dụng tối thiểu, ưu tiên hoàn thiện luồng tìm sân, đặt sân, thanh toán và quản lý lịch. Hoàn tiền hiện vẫn do người vận hành thực hiện thủ công. Việc mở nhận đơn cho nhiều chủ sân cần hoàn tất nghiệm thu chuyển khoản thật trước.”

## 2. Sáu điều cần hiểu để giải thích bằng lời của mình

### 2.1. Website vận hành như một quầy đặt sân

| Thành phần | Hiểu đơn giản | Việc trong Sân Ngon |
| --- | --- | --- |
| Giao diện, còn gọi là frontend | Quầy giao dịch khách nhìn thấy | Hiện sân, giờ trống, giá, form đặt và mã QR |
| Phần xử lý phía máy chủ, còn gọi là backend | Nhân viên tiếp nhận và xử lý yêu cầu | Kiểm tra đăng nhập, dữ liệu nhập và gọi xử lý nghiệp vụ |
| Cơ sở dữ liệu, còn gọi là database | Sổ đặt sân có quy tắc kiểm soát | Lưu sân, giá, đơn, thanh toán; tính giá và chặn đặt trùng |

Trong dự án này, nhiều quy tắc quan trọng được viết ngay trong cơ sở dữ liệu PostgreSQL. Ví dụ, yêu cầu đặt sân phải đi qua cùng một quy trình kiểm tra và tính giá trước khi ghi đơn.

**Câu dễ nhớ:** “Màn hình nhận lựa chọn của khách; hệ thống phía máy chủ kiểm tra và quyết định đơn có hợp lệ hay không.”

### 2.2. Hai người bấm đặt cùng lúc thì sao?

Ví dụ một sân cầu lông chỉ còn khung 18:00–19:00. Bạn A và bạn B mở trang cùng lúc, nên cả hai đều có thể thấy khung đó đang trống.

Nếu chỉ dựa vào màn hình, cả hai có thể cùng bấm đặt. Vì vậy, cơ sở dữ liệu có một quy tắc bắt buộc: **cùng một sân, các đơn đang giữ chỗ hợp lệ hoặc đã xác nhận không được chồng lấn thời gian**. Khi hai yêu cầu tranh nhau một khung, chỉ một yêu cầu được ghi thành công.

Nếu thầy hỏi tên kỹ thuật: đó là **ràng buộc loại trừ GiST trong PostgreSQL**. Chỉ cần nhớ tác dụng, không cần giải thích thuật toán bên trong.

Hai sân khác nhau vẫn được đặt cùng giờ. Một “cụm sân” là một địa điểm có thể chứa nhiều sân cụ thể; mỗi đơn chỉ đặt một sân cụ thể.

**Câu dễ nhớ:** “Lịch trống giúp khách lựa chọn; quy tắc trong cơ sở dữ liệu mới là lớp chặn đặt trùng cuối cùng.”

### 2.3. Vì sao khách không tự sửa giá được?

Trình duyệt là phần chạy trên thiết bị của khách, nên hệ thống không lấy con số khách gửi lên làm giá cuối cùng.

Khách gửi lựa chọn sân và khoảng thời gian. Hệ thống tra bảng giá, tính tiền rồi lưu giá vào đơn. Chẳng hạn, nếu giá đúng là 200.000đ thì việc sửa màn hình thành 20.000đ không làm đơn được tạo với giá 20.000đ.

Giá đã lưu trong đơn được giữ lại để đối soát. Chủ sân đổi bảng giá sau đó không tự làm thay đổi giá của đơn cũ.

**Câu dễ nhớ:** “Khách chọn sân và giờ; hệ thống quyết định số tiền.”

### 2.4. Website biết khách đã chuyển tiền bằng cách nào?

Luồng thông thường:

1. Khách tạo đơn; hệ thống giữ chỗ 15 phút.
2. Trang thanh toán hiện QR, số tiền, người nhận và nội dung chuyển khoản có mã đơn.
3. Khách thực hiện chuyển khoản trong ứng dụng ngân hàng.
4. SePay gửi thông báo giao dịch đến website.
5. Hệ thống kiểm tra người nhận, mã đơn, số tiền và giao dịch; đơn còn hạn và hợp lệ được xác nhận.
6. Trang thanh toán nhận thay đổi trạng thái và cập nhật cho khách.

Thông báo ở bước 4 gọi là **webhook**: có sự kiện xảy ra thì dịch vụ chủ động báo cho website. Có thể ví như ngân hàng có giao dịch thì một bên tích hợp gửi “giấy báo” đến hệ thống.

QR chỉ giúp điền thông tin chuyển khoản. **Mở QR hoặc quét QR chưa có nghĩa là đã thanh toán.** Việc tự động xác nhận dựa trên thông báo giao dịch đã được kiểm tra, không dựa vào ảnh chụp chuyển khoản của khách.

Các trường hợp cần biết:

- Hết thời hạn giữ chỗ: sân được mở lại cho người khác.
- Thông báo tiền vào đến sau khi đơn hết hạn: không tự giành lại sân; chuyển sang xử lý khoản cần hoàn.
- Cùng một thông báo được gửi lại: hệ thống nhận ra mã giao dịch đã xử lý để tránh xác nhận lặp.
- Chuyển thiếu tiền: không đủ điều kiện tự động xác nhận đơn.
- Chủ sân xác nhận thủ công: chỉ dùng với đơn còn hạn, sau khi thực sự kiểm tra tiền vào.

**Lưu ý khi nói:** giao diện gọi khoản này là “cọc”, nhưng đơn mới hiện yêu cầu chuyển **100% tổng tiền sân**. Thông tin tài khoản nhận được lưu theo từng đơn; khách phải làm theo thông tin trên đơn đó.

### 2.5. “Cập nhật thời gian thực” có nghĩa gì?

Hiểu đơn giản là khi dữ liệu thay đổi, trang có thể nhận thông báo và tự cập nhật mà khách không phải bấm tải lại thủ công. Ví dụ, trạng thái thanh toán chuyển từ chờ sang đã xác nhận.

Lịch chọn sân còn tải lại định kỳ và khi người dùng quay lại trang để làm mới thông tin. Tuy nhiên, mạng có thể chậm hoặc mất kết nối, nên không nên nói “mọi người luôn thấy thay đổi ngay lập tức”. Khi tạo đơn, hệ thống vẫn phải kiểm tra lịch lại.

**Câu dễ nhớ:** “Tự cập nhật giúp thông tin mới hơn; kiểm tra lúc đặt giúp đơn chính xác.”

### 2.6. Bảo vệ dữ liệu như thế nào?

Có ba lớp dễ trình bày:

- **Đăng nhập:** xác định người đang sử dụng hệ thống là ai.
- **Phân quyền:** xác định người đó được xem và làm gì. Người chơi không được tự sửa đơn thành đã thanh toán; chủ sân chỉ quản lý dữ liệu thuộc phạm vi của mình.
- **Bảo vệ dữ liệu và khóa kết nối:** giấy tờ chủ sân được lưu riêng tư; khóa bí mật không đưa xuống trình duyệt. Thông tin bí mật của kết nối SePay được mã hóa khi lưu.

Quy tắc giới hạn từng dòng dữ liệu theo người dùng gọi là **RLS**. Ví dụ, người chơi có thể xem đơn của mình nhưng không được đọc thông tin đặt sân riêng của khách khác.

**Câu dễ nhớ:** “Không chỉ giấu nút; hệ thống còn kiểm tra quyền khi truy cập dữ liệu.”

## 3. Tên công nghệ — chỉ cần biết mỗi thứ làm gì

| Công nghệ | Cách giải thích cho người không chuyên | Lý do dùng trong dự án |
| --- | --- | --- |
| Next.js và React | Công cụ xây dựng trang web và các phần tương tác | Làm giao diện và phần tiếp nhận yêu cầu trong cùng dự án |
| TypeScript | Ngôn ngữ lập trình có kiểm tra kiểu dữ liệu | Giúp phát hiện sớm một số lỗi khi viết code |
| Tailwind CSS | Công cụ định dạng màu, chữ và bố cục | Làm giao diện nhất quán, thích ứng với máy tính và điện thoại |
| Supabase | Dịch vụ cung cấp sẵn cơ sở dữ liệu, đăng nhập, lưu tệp và cập nhật dữ liệu | Giảm việc nhóm nhỏ phải tự xây và vận hành các phần nền tảng |
| PostgreSQL | Hệ cơ sở dữ liệu bên trong Supabase | Lưu dữ liệu có liên kết và áp dụng quy tắc giao dịch, chống trùng |
| SePay | Dịch vụ kết nối thông tin giao dịch ngân hàng với website | Hỗ trợ đối chiếu chuyển khoản để xác nhận đơn |
| Vercel | Nền tảng đưa website lên Internet | Thuận tiện triển khai website Next.js |

Supabase và PostgreSQL không phải hai nơi lưu dữ liệu tách biệt trong thiết kế này: Supabase cung cấp dịch vụ cơ sở dữ liệu dùng PostgreSQL.

Nếu hỏi “API là gì?”: API là cách các phần mềm gửi yêu cầu và trả kết quả cho nhau. Trong web này, thao tác đặt sân trên giao diện gửi yêu cầu đến phần xử lý qua API.

Không cần đọc hết bảng khi thuyết trình. Chỉ cần nói: **“Next.js làm web, Supabase cung cấp dữ liệu và đăng nhập, SePay báo chuyển khoản, Vercel triển khai website.”**

## 4. Những câu thầy có thể hỏi

**Tại sao làm website mà không làm ứng dụng điện thoại?**

“Người dùng mở liên kết là sử dụng được, không phải cài ứng dụng. Website phục vụ được cả máy tính và điện thoại, phù hợp nguồn lực và thời gian của giai đoạn thử nghiệm.”

**Tại sao không quản lý bằng Excel hoặc gọi điện?**

“Excel hỗ trợ ghi chép, nhưng riêng một bảng tính chưa cung cấp trọn luồng để khách tự xem lịch, giữ chỗ, chuyển khoản và theo dõi đơn. Website kết nối các bước đó và kiểm soát đặt trùng tại cơ sở dữ liệu.”

**Dùng Supabase rồi thì nhóm tự làm gì?**

“Supabase cung cấp nền tảng. Phần riêng của sản phẩm là luồng đặt sân, giao diện, cấu trúc dữ liệu, quy tắc tính giá và giữ chỗ, phân quyền, quản lý sân và tích hợp thanh toán.”

**Dữ liệu được lưu ra sao?**

“Dữ liệu chia thành các bảng liên quan với nhau: tài khoản, cụm sân, sân cụ thể, bảng giá, đơn đặt và thanh toán. Ví dụ, từ một đơn có thể biết khách nào đặt, sân nào, thời gian nào và thanh toán ra sao.”

**Chủ sân có được tự đăng sân ngay không?**

“Chủ sân cần gửi hồ sơ để quản trị viên duyệt tài khoản. Sau khi được duyệt, họ tạo cụm sân ở dạng nháp và bổ sung đủ ảnh thật để công khai. Việc nhận đơn còn phải đáp ứng điều kiện kết nối thanh toán và vận hành của hệ thống.”

**Nếu khách giữ sân rồi không trả tiền thì sao?**

“Mỗi đơn chỉ giữ chỗ 15 phút. Hết hạn thì khung được mở lại. Mỗi tài khoản được giữ tối đa hai đơn chờ còn hạn để hạn chế giữ nhiều chỗ mà không thanh toán.”

**Hủy đơn có được hoàn tiền không?**

“Hệ thống hiện dùng mốc hai giờ trước giờ chơi để xét hoàn cọc khi khách hủy. Đây là mốc đang chờ chốt với chủ sân. Hệ thống ghi nhận khoản cần hoàn; người vận hành thực hiện chuyển hoàn thủ công.”

**Nếu mất mạng hoặc SePay gặp lỗi thì sao?**

“Dữ liệu đơn đã ghi thành công vẫn nằm ở hệ thống. Khi kết nối trở lại, giao diện tải lại trạng thái. Nếu chưa nhận được thông báo thanh toán thì không thể mặc định khách đã trả tiền; người vận hành cần kiểm tra giao dịch và trạng thái đơn để xử lý.”

**Web có an toàn tuyệt đối không?**

“Nhóm có các cơ chế như đăng nhập, phân quyền dữ liệu, tính giá phía máy chủ và kiểm tra thông báo thanh toán. Mức độ an toàn còn phụ thuộc cấu hình, kiểm thử và vận hành; nhóm không khẳng định an toàn tuyệt đối.”

**Web chịu được bao nhiêu người dùng cùng lúc?**

“Hiện chưa có số liệu kiểm thử tải để cam kết một con số. Nhóm ưu tiên kiểm tra tính đúng của luồng đặt sân; trước khi mở rộng cần đo lượng truy cập, thời gian phản hồi và giới hạn dịch vụ.”

**Chi phí vận hành bao nhiêu?**

“Chi phí gồm nền tảng chạy web, cơ sở dữ liệu, tên miền, dịch vụ thanh toán và email tùy cấu hình. Cần tính theo gói và mức sử dụng thực tế; chưa nên kết luận vận hành miễn phí lâu dài.”

**Website có thu phí chủ sân không?**

“Đã có chức năng thu phí dịch vụ 299.000đ mỗi tháng cho một chủ sân, áp dụng cho tất cả cụm sân của họ. Mặc định tài khoản được miễn phí; quản trị viên quyết định bật thu phí. Đây là phí dịch vụ website, tách với tiền khách trả để đặt sân.”

**Đã sẵn sàng cho nhiều chủ sân nhận tiền chưa?**

“Code đã có kết nối SePay riêng cho chủ sân. Theo kế hoạch vận hành hiện tại, việc mở nhận đơn cho nhiều chủ sân vẫn cần nghiệm thu OAuth, thông tin người nhận và chuyển khoản thật trước.”

**Ai phát triển phần kỹ thuật?**

Trả lời đúng vai trò thực tế. Nếu người trình bày phụ trách ý tưởng hoặc kinh doanh và nhờ người khác phát triển, có thể nói: “Em phụ trách [phần thực tế mình làm], phối hợp với người phát triển để xây dựng website. Em trình bày được cách hệ thống vận hành và những quyết định chính.” Không nhận là tự viết toàn bộ nếu thực tế không phải vậy.

## 5. Minh họa trực tiếp khi trình bày

Nên chọn một luồng ngắn, tập trước trên đúng website sẽ dùng:

| Bước | Thao tác | Câu giải thích đi kèm |
| --- | --- | --- |
| 1 | Mở trang tìm sân và chọn một cụm sân | “Khách tự tìm sân và xem thông tin trên web.” |
| 2 | Chọn môn, thời lượng và giờ còn sân | “Hệ thống gợi ý sân còn trống trong toàn bộ khoảng chơi.” |
| 3 | Tạo một đơn thử | “Hệ thống kiểm tra lịch và tính lại tiền trước khi ghi đơn.” |
| 4 | Mở trang QR và thời hạn giữ chỗ | “Đơn được giữ 15 phút để khách chuyển khoản.” |
| 5 | Mở tài khoản chủ sân đã chuẩn bị | “Chủ sân theo dõi đơn và lịch tập trung.” |

Nếu chưa chuẩn bị và nghiệm thu chuyển khoản thật, có thể dừng ở bước QR. Chỉ giới thiệu cơ chế tự xác nhận, không gọi đơn chờ là đơn đã thanh toán. Muốn minh họa giao dịch thành công, dùng giao dịch thử đã đối soát và mô tả đúng cách thực hiện.

Sau khi demo, hủy đơn thử bằng nút hủy để trả lịch. Chỉ đóng trang hoặc về trang chủ không hủy giữ chỗ ngay.

## 6. Những điểm cần nói đúng về phiên bản hiện tại

- Đây là **website**, chưa có ứng dụng điện thoại cài riêng.
- Một đơn đặt **một sân cụ thể**, không đặt nhiều sân trong một đơn.
- Tiền cần chuyển của đơn mới hiện bằng **100% tiền sân**.
- Hoàn tiền là **thủ công**; mốc hủy được hoàn đang dùng là hai giờ và còn chờ chốt.
- Đã có code tích hợp không đồng nghĩa với đã nghiệm thu trên môi trường thật. Đặc biệt cần kiểm tra chuyển khoản và email trước khi đưa vào bài demo.
- Chưa có cơ sở để nói hệ thống đã phục vụ số lượng lớn người dùng hoặc đã đạt một mức doanh thu cụ thể.
- Bản đồ, đánh giá sao, tìm đối ghép kèo và ví nội bộ chưa thuộc bản hiện tại.

Nếu chỉ nhớ năm câu trước khi lên trình bày:

1. **Khách tự tìm giờ còn sân; chủ sân quản lý lịch tập trung.**
2. **Cơ sở dữ liệu chặn hai đơn trùng giờ trên cùng một sân.**
3. **Giá được tính phía máy chủ và lưu vào đơn.**
4. **SePay báo giao dịch; hệ thống kiểm tra rồi mới xác nhận.**
5. **Bản hiện tại ưu tiên luồng đặt sân, còn hoàn tiền xử lý thủ công.**

---

Nguồn đối chiếu dành cho người chuẩn bị tài liệu, không cần học thuộc: [bối cảnh dự án](../AGENTS.md), [công nghệ đang dùng](../package.json), [API tạo đơn](../app/api/bookings/route.ts), [quy tắc tạo đơn và thanh toán toàn bộ](../supabase/migrations/20260926000000_full_booking_deposit.sql), [vận hành SePay](sepay-single-owner.md), [checklist nghiệm thu](mvp-acceptance.md).
