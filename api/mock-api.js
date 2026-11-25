(() => {
  const products = [
    {
      id: "notebook-hardcover",
      name: "Sổ tay bìa cứng sáng tạo",
      category: ["notebook"],
      image:
        "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=600&q=85",
      price: 69000,
      originalPrice: 98000,
      rating: 4.9,
      reviewCount: 86,
      popular: true,
      sale: true,
      latest: true,
    },
    {
      id: "pastel-pens",
      name: "Bộ bút màu pastel 4 chiếc",
      category: ["pen", "color"],
      image:
        "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=85",
      price: 45000,
      originalPrice: 59000,
      rating: 4.8,
      reviewCount: 65,
      popular: true,
      sale: true,
      latest: true,
    },
    {
      id: "canvas-pencil-case",
      name: "Túi bút canvas tiện dụng",
      category: ["accessory"],
      image:
        "https://images.unsplash.com/photo-1586074299757-dc655f18518c?auto=format&fit=crop&w=600&q=85",
      price: 85000,
      originalPrice: 112000,
      rating: 4.9,
      reviewCount: 112,
      popular: true,
      sale: true,
      latest: false,
    },
    {
      id: "color-notes",
      name: "Giấy ghi chú nhiều màu",
      category: ["stationery", "desk"],
      image:
        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=85",
      price: 29000,
      originalPrice: 39000,
      rating: 4.7,
      reviewCount: 48,
      popular: false,
      sale: true,
      latest: false,
    },
    {
      id: "spiral-notebook",
      name: "Sổ lò xo kẻ ngang 120 trang",
      category: ["notebook"],
      image:
        "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=85",
      price: 52000,
      originalPrice: 65000,
      rating: 4.8,
      reviewCount: 37,
      popular: true,
      sale: true,
      latest: false,
    },
    {
      id: "highlighter-set",
      name: "Bộ bút đánh dấu Highlight 6 màu",
      category: ["pen", "color"],
      image:
        "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=600&q=85",
      price: 79000,
      originalPrice: 95000,
      rating: 4.9,
      reviewCount: 53,
      popular: true,
      sale: true,
      latest: true,
    },
    {
      id: "watercolor-kit",
      name: "Hộp màu nước kèm cọ vẽ",
      category: ["color", "desk"],
      image:
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=85",
      price: 125000,
      originalPrice: 149000,
      rating: 4.8,
      reviewCount: 29,
      popular: false,
      sale: true,
      latest: true,
    },
    {
      id: "desk-organizer",
      name: "Kệ để bút mini để bàn",
      category: ["stationery", "desk"],
      image:
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=85",
      price: 99000,
      originalPrice: null,
      rating: 4.6,
      reviewCount: 21,
      popular: true,
      sale: false,
      latest: false,
    },
    {
      id: "study-stickers",
      name: "Bộ sticker trang trí sổ tay",
      category: ["stationery", "desk"],
      image:
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=85",
      price: 35000,
      originalPrice: null,
      rating: 4.7,
      reviewCount: 18,
      popular: false,
      sale: false,
      latest: true,
    },
    {
      id: "pencil-case-zip",
      name: "Hộp bút khóa kéo màu kem",
      category: ["accessory"],
      image:
        "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=600&q=85",
      price: 75000,
      originalPrice: 89000,
      rating: 4.8,
      reviewCount: 42,
      popular: true,
      sale: true,
      latest: true,
    },
    {
      id: "sketchbook",
      name: "Sổ vẽ mỹ thuật giấy dày",
      category: ["notebook", "color"],
      image:
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=85",
      price: 68000,
      originalPrice: null,
      rating: 4.9,
      reviewCount: 31,
      popular: false,
      sale: false,
      latest: true,
    },
    {
      id: "geometry-set",
      name: "Bộ thước học sinh 4 món",
      category: ["stationery", "desk"],
      image:
        "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=600&q=85",
      price: 25000,
      originalPrice: null,
      rating: 4.6,
      reviewCount: 16,
      popular: false,
      sale: false,
      latest: false,
    },
    {
      id: "study-gift-set",
      name: "Bộ quà tặng học tập",
      category: ["gift"],
      image:
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=85",
      price: 189000,
      originalPrice: 219000,
      rating: 4.9,
      reviewCount: 14,
      popular: false,
      sale: true,
      latest: true,
    },
  ];

  const reviews = [
    {
      name: "Lan Anh",
      product: "Sổ tay",
      rating: 5,
      comment: "Sổ có chất giấy đẹp, viết êm và thiết kế nhỏ gọn. Mình rất thích!",
    },
    {
      name: "Hoài Thương",
      product: "Bút màu",
      rating: 5,
      comment: "Bút màu lên màu đẹp, giao hàng nhanh và đóng gói cẩn thận.",
    },
    {
      name: "Châu Nguyễn",
      product: "Túi bút",
      rating: 5,
      comment: "Túi bút xinh, chất vải chắc chắn, vừa đủ dùng mỗi ngày.",
    },
    {
      name: "Minh Khuê",
      product: "Sổ tay",
      rating: 5,
      comment: "Màu bìa ngoài đời rất đẹp, giấy dày và không bị lem mực.",
    },
    {
      name: "Quốc Bảo",
      product: "Bút màu",
      rating: 4,
      comment: "Màu sắc đa dạng, cầm chắc tay. Bé nhà mình rất thích.",
    },
    {
      name: "Thảo Vy",
      product: "Giấy ghi chú",
      rating: 5,
      comment: "Giấy bám tốt, màu pastel dịu mắt, dùng để ghi chú rất tiện.",
    },
    {
      name: "Ngọc Hà",
      product: "Túi bút",
      rating: 5,
      comment: "Đường may chắc chắn, có nhiều ngăn và giao hàng nhanh.",
    },
    {
      name: "Đức Anh",
      product: "Sổ tay",
      rating: 4,
      comment: "Sổ gọn nhẹ, mang đi học tiện. Đóng gói cẩn thận.",
    },
    {
      name: "Mai Phương",
      product: "Giấy ghi chú",
      rating: 5,
      comment: "Màu đẹp, giấy dễ viết. Mình sẽ mua thêm cho cả văn phòng.",
    },
  ];

  function getPage(data, offset, limit) {
    if (!Number.isInteger(offset) || offset < 0) {
      return Promise.reject(new RangeError("offset phải là số nguyên không âm."));
    }
    if (!Number.isInteger(limit) || limit < 1) {
      return Promise.reject(new RangeError("limit phải là số nguyên dương."));
    }

    return new Promise((resolve) => {
      window.setTimeout(() => {
        const page = data
          .slice(offset, offset + limit)
          .map((item) => ({ ...item }));
        const nextOffset = offset + page.length;
        resolve({
          items: page,
          total: data.length,
          nextOffset: nextOffset < data.length ? nextOffset : null,
        });
      }, 180);
    });
  }

  window.mockApi = {
    getProducts({ offset = 0, limit = 12 } = {}) {
      return getPage(products, offset, limit).then((page) => ({
        products: page.items,
        total: page.total,
        nextOffset: page.nextOffset,
      }));
    },
    getReviews({ offset = 0, limit = 3 } = {}) {
      return getPage(reviews, offset, limit).then((page) => ({
        reviews: page.items,
        total: page.total,
        nextOffset: page.nextOffset,
      }));
    },
  };
})();
