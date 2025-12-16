package com.example.koornikbe.controller;

import com.example.koornikbe.dto.PixelColorData;
import com.example.koornikbe.model.Image;
import com.example.koornikbe.service.ImageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.nio.file.Path;
import java.util.List;

@RestController
@RequestMapping("/api/images")
@RequiredArgsConstructor
public class ImageController {
    private final ImageService service;

    @GetMapping
    public List<Image> getAll() {
        return service.getAllImages();
    }

    @GetMapping("/{id}")
    public Image getById(@PathVariable Long id) {
        return service.getImageById(id);
    }

    @PostMapping
    public ResponseEntity<Image> create(@RequestBody Image body) {
        Image created = service.addImage(body);
        return ResponseEntity.created(URI.create("/api/images/" + created.getImageid())).body(created);
    }

    @PostMapping("/white")
    public ResponseEntity<Image> createWhite(
            @RequestParam int width,
            @RequestParam int height
    ) {
        Image created = service.createWhiteImage(width, height);
        return ResponseEntity
                .created(URI.create("/api/images/" + created.getImageid()))
                .body(created);
    }

    @PostMapping("/{id}/pixels")
    public ResponseEntity<Image> updatePixels(
            @PathVariable Long id,
            @RequestBody List<PixelColorData> pixels
    ) {
        Image updated = service.updateImageFromPixels(id, pixels);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/export")
    public ResponseEntity<String> exportImage(@PathVariable Long id) {
        Path path = service.exportImageToProjectDir(id);
        return ResponseEntity.ok(
                "Image exported to: " + path.toAbsolutePath()
        );
    }

    @PutMapping("/{id}")
    public Image update(@PathVariable Long id, @RequestBody Image body) {
        return service.updateImage(id, body);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.deleteImage(id);
    }
}
